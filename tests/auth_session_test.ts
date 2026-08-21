// Integration tests for session management.
// Tests creation, cookie round-trip, expiry, and logout invalidation.

import { describe, it } from "jsr:@std/testing@1/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { createSession, validateSession, deleteSession, sessionCookieHeader, clearSessionCookieHeader, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { execute, queryOne, closePool } from "../api/db.ts";
import { cleanupTestData, closeTestClient, getTestClient, testUsername } from "./helpers.ts";

describe("auth/session", { sanitizeOps: false, sanitizeResources: false }, () => {
  let testUserId: string;

  it("setup: cleanup and create test user", async () => {
    await cleanupTestData();
    const client = await getTestClient();
    const result = await client.queryObject<{ id: string }>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [testUsername("session"), "fake_hash"],
    );
    testUserId = result.rows[0].id;
  });

  it("createSession returns a hex token", async () => {
    const token = await createSession(testUserId);
    assertEquals(typeof token, "string");
    assertEquals(token.length, 64); // 32 bytes = 64 hex chars
  });

  it("validateSession returns user_id for valid token", async () => {
    const token = await createSession(testUserId);
    const userId = await validateSession(token);
    assertEquals(userId, testUserId);
  });

  it("validateSession returns null for invalid token", async () => {
    const userId = await validateSession("deadbeef".repeat(8));
    assertEquals(userId, null);
  });

  it("deleteSession invalidates the token", async () => {
    const token = await createSession(testUserId);
    await deleteSession(token);
    const userId = await validateSession(token);
    assertEquals(userId, null);
  });

  it("sessionCookieHeader sets correct attributes", () => {
    const header = sessionCookieHeader("abc123");
    assertEquals(header.includes("HttpOnly"), true);
    assertEquals(header.includes("SameSite=Lax"), true);
    assertEquals(header.includes("Path=/"), true);
    assertEquals(header.includes(`${SESSION_COOKIE_NAME}=abc123`), true);
  });

  it("clearSessionCookieHeader sets Max-Age=0", () => {
    const header = clearSessionCookieHeader();
    assertEquals(header.includes("Max-Age=0"), true);
    assertEquals(header.includes("HttpOnly"), true);
  });

  it("two sessions produce different tokens", async () => {
    const t1 = await createSession(testUserId);
    const t2 = await createSession(testUserId);
    assertNotEquals(t1, t2);
  });

  it("teardown: cleanup test data and close connections", async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });
});
