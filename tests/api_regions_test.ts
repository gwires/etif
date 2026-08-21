// Integration tests for /api/regions CRUD endpoints.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool } from "../api/db.ts";
import { createSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { handleCreateIssue } from "../api/issues/handlers.ts";
import {
  handleGetRegions,
  handleCreateRegion,
  handleDeleteRegion,
  handleFindIssuesByRegion,
} from "../api/regions/handlers.ts";

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

describe("Regions API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let cookie: string;
  let issueId: string;
  let regionId: string;
  const testS2CellId = 9876543210;

  beforeAll(async () => {
    await cleanupTestData();
    cookie = await createTestUserWithSession("regions");

    const res = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_region_issue" }, cookie }),
    );
    issueId = (await res.json()).id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("rejects unauthenticated GET regions for issue", async () => {
    const res = await handleGetRegions(
      makeRequest(`/api/issues/${issueId}/regions`),
    );
    assertEquals(res.status, 401);
  });

  it("rejects unauthenticated GET find by S2 cell", async () => {
    const res = await handleFindIssuesByRegion(
      makeRequest(`/api/regions?s2_cell_id=${testS2CellId}`),
    );
    assertEquals(res.status, 401);
  });

  it("rejects unauthenticated POST", async () => {
    const res = await handleCreateRegion(
      makeRequest(`/api/issues/${issueId}/regions`, {
        method: "POST",
        body: { s2_cell_id: testS2CellId, region_name: "Test Region" },
      }),
    );
    assertEquals(res.status, 401);
  });

  it("creates a region", async () => {
    const res = await handleCreateRegion(
      makeRequest(`/api/issues/${issueId}/regions`, {
        method: "POST",
        body: { s2_cell_id: testS2CellId, region_name: "North Sea" },
        cookie,
      }),
    );
    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.issue_id, issueId);
    assertEquals(data.s2_cell_id, String(testS2CellId));
    assertEquals(data.region_name, "North Sea");
    regionId = data.id;
  });

  it("creates a region without name", async () => {
    const res = await handleCreateRegion(
      makeRequest(`/api/issues/${issueId}/regions`, {
        method: "POST",
        body: { s2_cell_id: 1111111111 },
        cookie,
      }),
    );
    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.region_name, null);
  });

  it("rejects missing s2_cell_id", async () => {
    const res = await handleCreateRegion(
      makeRequest(`/api/issues/${issueId}/regions`, {
        method: "POST",
        body: { region_name: "No cell" },
        cookie,
      }),
    );
    assertEquals(res.status, 400);
  });

  it("returns 404 for nonexistent issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleCreateRegion(
      makeRequest(`/api/issues/${fakeId}/regions`, {
        method: "POST",
        body: { s2_cell_id: testS2CellId },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });

  it("gets regions for an issue", async () => {
    const res = await handleGetRegions(
      makeRequest(`/api/issues/${issueId}/regions`, { cookie }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length >= 2, true); // named + unnamed
  });

  it("returns empty array for issue with no regions", async () => {
    const res2 = await handleCreateIssue(
      makeRequest("/api/issues", { method: "POST", body: { title: "_test_no_regions" }, cookie }),
    );
    const noRegionIssueId = (await res2.json()).id;
    const res = await handleGetRegions(
      makeRequest(`/api/issues/${noRegionIssueId}/regions`, { cookie }),
    );
    const data = await res.json();
    assertEquals(data.length, 0);
  });

  it("returns 404 for regions on nonexistent issue", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleGetRegions(
      makeRequest(`/api/issues/${fakeId}/regions`, { cookie }),
    );
    assertEquals(res.status, 404);
  });

  it("finds issues by S2 cell", async () => {
    const res = await handleFindIssuesByRegion(
      makeRequest(`/api/regions?s2_cell_id=${testS2CellId}`, { cookie }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length >= 1, true);
    assertEquals(data[0].id, issueId);
  });

  it("requires s2_cell_id param for region search", async () => {
    const res = await handleFindIssuesByRegion(
      makeRequest("/api/regions", { cookie }),
    );
    assertEquals(res.status, 400);
  });

  it("rejects invalid s2_cell_id", async () => {
    const res = await handleFindIssuesByRegion(
      makeRequest("/api/regions?s2_cell_id=notanumber", { cookie }),
    );
    assertEquals(res.status, 400);
  });

  it("deletes a region", async () => {
    const res = await handleDeleteRegion(
      makeRequest(`/api/regions/${regionId}`, { method: "DELETE", cookie }),
    );
    assertEquals(res.status, 204);
  });

  it("returns 404 on delete of nonexistent region", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleDeleteRegion(
      makeRequest(`/api/regions/${fakeId}`, { method: "DELETE", cookie }),
    );
    assertEquals(res.status, 404);
  });

  it("confirms region is gone after delete", async () => {
    const res = await handleGetRegions(
      makeRequest(`/api/issues/${issueId}/regions`, { cookie }),
    );
    const data = await res.json();
    const deleted = data.find((r: { id: string }) => r.id === regionId);
    assertEquals(deleted, undefined);
  });
});
