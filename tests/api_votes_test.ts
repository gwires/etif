// Integration tests for /api/votes endpoints.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool, queryOne } from "../api/db.ts";
import { createSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { handleVote } from "../api/votes/handlers.ts";
import { handleCreateIssue } from "../api/issues/handlers.ts";
import { handleCreateComment } from "../api/comments/handlers.ts";

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

describe("Votes API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let cookie: string;
  let issueId: string;
  let commentId: string;

  beforeAll(async () => {
    await cleanupTestData();
    cookie = await createTestUserWithSession("votes");

    // Create a test issue to vote on
    const issueRes = await handleCreateIssue(
      makeRequest("/api/issues", {
        method: "POST",
        body: { title: "_test_vote_issue", body: "Vote target", severity: 3 },
        cookie,
      }),
    );
    const issueData = await issueRes.json();
    issueId = issueData.id;

    // Create a test comment to vote on
    const commentRes = await handleCreateComment(
      makeRequest(`/api/issues/${issueId}/comments`, {
        method: "POST",
        body: { body: "_test_vote_comment" },
        cookie,
      }),
    );
    const commentData = await commentRes.json();
    commentId = commentData.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("rejects unauthenticated vote", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: 1 },
      }),
    );
    assertEquals(res.status, 401);
  });

  it("creates an upvote on an issue", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: 1 },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.action, "created");
    assertEquals(data.new_score, 1);
  });

  it("toggles off same vote", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: 1 },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.action, "deleted");
    assertEquals(data.new_score, 0);
  });

  it("changes vote direction", async () => {
    // First upvote
    await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: 1 },
        cookie,
      }),
    );
    // Then downvote
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: -1 },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.action, "updated");
    assertEquals(data.new_score, -1);
  });

  it("votes on a comment", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "comment", target_id: commentId, value: 1 },
        cookie,
      }),
    );
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.action, "created");
    assertEquals(data.new_score, 1);
  });

  it("rejects invalid target_type", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "invalid", target_id: issueId, value: 1 },
        cookie,
      }),
    );
    assertEquals(res.status, 400);
  });

  it("rejects invalid value", async () => {
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: issueId, value: 2 },
        cookie,
      }),
    );
    assertEquals(res.status, 400);
  });

  it("returns 404 for nonexistent target", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await handleVote(
      makeRequest("/api/votes", {
        method: "POST",
        body: { target_type: "issue", target_id: fakeId, value: 1 },
        cookie,
      }),
    );
    assertEquals(res.status, 404);
  });
});
