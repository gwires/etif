// Integration tests for /api/graph traversal endpoint.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool } from "../api/db.ts";
import { createSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { handleCreateIssue } from "../api/issues/handlers.ts";
import { handleCreateRelation } from "../api/relations/handlers.ts";
import { handleGraph } from "../api/graph/handlers.ts";

async function createTestUserWithSession(suffix: string): Promise<string> {
  const client = await getTestClient();
  const username = testUsername(suffix);
  await client.queryArray(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [username, "$argon2id$fake"],
  );
  const row = await client.queryObject<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [username],
  );
  const token = await createSession(row.rows[0].id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function makeRequest(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  return new Request(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("Graph API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let cookie: string;
  let a: string; // root
  let b: string; // a→b
  let c: string; // b→c
  let d: string; // c→d (depth 3 from a)
  let e: string; // isolated node

  beforeAll(async () => {
    await cleanupTestData();
    cookie = await createTestUserWithSession("graph");

    // Create a chain: a → b → c → d, plus isolated e
    const mkIssue = async (title: string) => {
      const res = await handleCreateIssue(
        makeRequest("/api/issues", { method: "POST", body: { title }, cookie }),
      );
      return (await res.json()).id;
    };

    a = await mkIssue("_test_graph_a");
    b = await mkIssue("_test_graph_b");
    c = await mkIssue("_test_graph_c");
    d = await mkIssue("_test_graph_d");
    e = await mkIssue("_test_graph_e");

    const mkRel = async (src: string, tgt: string) => {
      await handleCreateRelation(
        makeRequest(`/api/issues/${src}/relations`, {
          method: "POST",
          body: { target_id: tgt, relation_type: "causes" },
          cookie,
        }),
      );
    };

    await mkRel(a, b);
    await mkRel(b, c);
    await mkRel(c, d);
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("requires root parameter", async () => {
    const res = await handleGraph(makeRequest("/api/graph"));
    assertEquals(res.status, 400);
  });

  it("rejects invalid direction", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&direction=sideways`));
    assertEquals(res.status, 400);
  });

  it("returns empty graph for isolated node", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${e}`));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.nodes.length, 0);
    assertEquals(data.edges.length, 0);
  });

  it("traverses outgoing edges with default depth", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}`));
    assertEquals(res.status, 200);
    const data = await res.json();
    // Should find a, b, c, d (3 hops from a)
    assertEquals(data.nodes.length, 4);
    assertEquals(data.edges.length, 3);
  });

  it("respects depth limit", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&depth=1`));
    const data = await res.json();
    // depth=1: only direct relations from a → b
    assertEquals(data.nodes.length, 2);
    assertEquals(data.edges.length, 1);
  });

  it("depth=2 reaches two hops", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&depth=2`));
    const data = await res.json();
    assertEquals(data.nodes.length, 3); // a, b, c
    assertEquals(data.edges.length, 2); // a→b, b→c
  });

  it("caps depth at max 10", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&depth=99`));
    assertEquals(res.status, 200);
    const data = await res.json();
    // Chain is only 3 deep, so all nodes found regardless of cap
    assertEquals(data.nodes.length, 4);
  });

  it("traverses incoming direction", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${d}&direction=incoming`));
    const data = await res.json();
    // d ← c ← b ← a
    assertEquals(data.nodes.length, 4);
    assertEquals(data.edges.length, 3);
  });

  it("incoming on leaf finds nothing outgoing", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&direction=incoming`));
    const data = await res.json();
    // a has no incoming edges
    assertEquals(data.nodes.length, 0);
    assertEquals(data.edges.length, 0);
  });

  it("both direction finds all connected", async () => {
    // Start from middle node b
    const res = await handleGraph(makeRequest(`/api/graph?root=${b}&direction=both&depth=3`));
    const data = await res.json();
    // Should reach a (incoming), c, d (outgoing)
    assertEquals(data.nodes.length, 4);
    assertEquals(data.edges.length, 3);
  });

  it("returns valid node and edge structure", async () => {
    const res = await handleGraph(makeRequest(`/api/graph?root=${a}&depth=1`));
    const data = await res.json();

    const node = data.nodes.find((n: { id: string }) => n.id === a);
    assertEquals(node !== undefined, true);
    assertEquals(typeof node.title, "string");
    assertEquals(typeof node.type, "string");
    assertEquals(typeof node.status, "string");

    const edge = data.edges[0];
    assertEquals(typeof edge.id, "string");
    assertEquals(typeof edge.source_id, "string");
    assertEquals(typeof edge.target_id, "string");
    assertEquals(typeof edge.relation_type, "string");
    assertEquals(typeof edge.depth, "number");
  });
});
