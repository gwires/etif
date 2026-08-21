// Integration tests for /api/issues CRUD endpoints.
// Tests call handler functions directly (no HTTP server needed).

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool, queryOne } from "../api/db.ts";
import { createSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { handleListIssues, handleCreateIssue, handleGetIssue, handleUpdateIssue } from "../api/issues/handlers.ts";

/** Create a test user + session, return cookie header string. */
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

describe("Issues API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let cookie: string;
  let createdIssueId: string;

  beforeAll(async () => {
    await cleanupTestData();
    cookie = await createTestUserWithSession("issues");
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("rejects unauthenticated POST", async () => {
    const res = await handleCreateIssue(makeRequest("/api/issues", { method: "POST", body: { title: "_test_unauth" } }));
    assertEquals(res.status, 401);
  });

  it("creates an issue", async () => {
    const res = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_issue_1", body: "Some body text", severity: 3 }, cookie }),
    );
    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.title, "_test_issue_1");
    assertEquals(data.body, "Some body text");
    assertEquals(data.severity, 3);
    assertEquals(data.type, "draft");
    assertEquals(data.status, "open");
    createdIssueId = data.id;
  });

  it("rejects create with missing title", async () => {
    const res = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { body: "no title" }, cookie }),
    );
    assertEquals(res.status, 400);
  });

  it("gets an issue by id", async () => {
    const res = await handleGetIssue(
      makeRequest(`/api/issues/${createdIssueId}`),
      createdIssueId,
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.id, createdIssueId);
    assertEquals(data.title, "_test_issue_1");
  });

  it("returns 404 for nonexistent issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleGetIssue(makeRequest(`/api/issues/${fakeId}`), fakeId);
    assertEquals(res.status, 404);
  });

  it("lists issues", async () => {
    // Create a second issue
    await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_issue_2", severity: 5 }, cookie }),
    );

    const res = await handleListIssues(makeRequest("/api/issues?limit=10&offset=0"));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(Array.isArray(data), true);
    const testIssues = data.filter((i: Record<string, unknown>) => String(i.title).startsWith("_test_"));
    assertEquals(testIssues.length >= 2, true);
  });

  it("filters issues by type", async () => {
    const res = await handleListIssues(makeRequest("/api/issues?type=draft"));
    assertEquals(res.status, 200);
    const data = await res.json();
    const nonDraft = data.filter((i: Record<string, unknown>) => i.type !== "draft");
    assertEquals(nonDraft.length, 0);
  });

  it("updates an issue", async () => {
    const res = await handleUpdateIssue(
      makeRequest(`/api/issues/${createdIssueId}`, {
        method: "PATCH",
        body: { title: "_test_issue_updated", status: "in_progress" },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.title, "_test_issue_updated");
    assertEquals(data.status, "in_progress");
  });

  it("rejects update on nonexistent issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleUpdateIssue(
      makeRequest(`/api/issues/${fakeId}`, {
        method: "PATCH",
        body: { title: "nope" },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });

  it("paginates results", async () => {
    const res = await handleListIssues(makeRequest("/api/issues?limit=1&offset=0"));
    const data = await res.json();
    assertEquals(data.length <= 1, true);
  });
});
