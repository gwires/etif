// Integration tests for /api/relations CRUD endpoints.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool } from "../api/db.ts";
import { createSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { handleCreateIssue } from "../api/issues/handlers.ts";
import {
  handleGetRelations,
  handleCreateRelation,
  handleUpdateRelation,
  handleDeleteRelation,
} from "../api/relations/handlers.ts";

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

function makeRequest(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  return new Request(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("Relations API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let cookie: string;
  let issue1Id: string;
  let issue2Id: string;
  let relationId: string;

  beforeAll(async () => {
    await cleanupTestData();
    cookie = await createTestUserWithSession("relations");

    // Create two test issues to relate
    const res1 = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_rel_source" }, cookie }),
    );
    issue1Id = (await res1.json()).id;

    const res2 = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_rel_target" }, cookie }),
    );
    issue2Id = (await res2.json()).id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("rejects unauthenticated POST", async () => {
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { target_id: issue2Id, relation_type: "causes" },
      }),
    );
    assertEquals(res.status, 401);
  });

  it("creates a relation", async () => {
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { target_id: issue2Id, relation_type: "causes", body: "Because reasons" },
        cookie,
      }),
    );
    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.source_id, issue1Id);
    assertEquals(data.target_id, issue2Id);
    assertEquals(data.relation_type, "causes");
    assertEquals(data.body, "Because reasons");
    relationId = data.id;
  });

  it("rejects duplicate relation", async () => {
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { target_id: issue2Id, relation_type: "causes" },
        cookie,
      }),
    );
    assertEquals(res.status, 409);
  });

  it("rejects invalid relation_type", async () => {
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { target_id: issue2Id, relation_type: "invalid_type" },
        cookie,
      }),
    );
    assertEquals(res.status, 400);
  });

  it("rejects missing target_id", async () => {
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { relation_type: "causes" },
        cookie,
      }),
    );
    assertEquals(res.status, 400);
  });

  it("returns 404 for nonexistent source issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${fakeId}/relations`, {
        method: "POST",
        body: { target_id: issue2Id, relation_type: "causes" },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });

  it("returns 404 for nonexistent target issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleCreateRelation(
      makeRequest(`/api/issues/${issue1Id}/relations`, {
        method: "POST",
        body: { target_id: fakeId, relation_type: "causes" },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });

  it("gets relations for an issue", async () => {
    const res = await handleGetRelations(
      makeRequest(`/api/issues/${issue1Id}/relations`),
      issue1Id,
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(Array.isArray(data.outgoing), true);
    assertEquals(Array.isArray(data.incoming), true);
    assertEquals(data.outgoing.length, 1);
    assertEquals(data.outgoing[0].other_id, issue2Id);
    assertEquals(data.outgoing[0].other_title, "_test_rel_target");
    assertEquals(data.incoming.length, 0);
  });

  it("shows incoming relations on target issue", async () => {
    const res = await handleGetRelations(
      makeRequest(`/api/issues/${issue2Id}/relations`),
      issue2Id,
    );
    const data = await res.json();
    assertEquals(data.incoming.length, 1);
    assertEquals(data.incoming[0].other_id, issue1Id);
    assertEquals(data.outgoing.length, 0);
  });

  it("returns 404 for relations on nonexistent issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleGetRelations(
      makeRequest(`/api/issues/${fakeId}/relations`),
      fakeId,
    );
    assertEquals(res.status, 404);
  });

  it("updates relation body", async () => {
    const res = await handleUpdateRelation(
      makeRequest(`/api/relations/${relationId}`, {
        method: "PATCH",
        body: { body: "Updated explanation" },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.body, "Updated explanation");
  });

  it("rejects update on nonexistent relation", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleUpdateRelation(
      makeRequest(`/api/relations/${fakeId}`, {
        method: "PATCH",
        body: { body: "nope" },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });

  it("deletes a relation", async () => {
    const res = await handleDeleteRelation(
      makeRequest(`/api/relations/${relationId}`, { method: "DELETE", cookie }),
    );
    assertEquals(res.status, 204);
  });

  it("returns 404 on delete of nonexistent relation", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleDeleteRelation(
      makeRequest(`/api/relations/${fakeId}`, { method: "DELETE", cookie }),
    );
    assertEquals(res.status, 404);
  });

  it("confirms relation is gone after delete", async () => {
    const res = await handleGetRelations(
      makeRequest(`/api/issues/${issue1Id}/relations`),
      issue1Id,
    );
    const data = await res.json();
    assertEquals(data.outgoing.length, 0);
  });
});
