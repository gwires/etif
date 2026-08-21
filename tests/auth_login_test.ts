// Integration tests for local login and logout flows.
// Tests credential verification, session creation, wrong password, nonexistent user.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { handleSignup } from "../api/auth/signup.ts";
import { handleLogin } from "../api/auth/login.ts";
import { handleLogout, handleMe } from "../api/auth/middleware.ts";
import { validateSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { closePool } from "../api/db.ts";

describe("auth/login", { sanitizeOps: false, sanitizeResources: false }, () => {
  beforeAll(async () => {
    await getTestClient();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  function loginRequest(body: Record<string, unknown>): Request {
    return new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function signupUser(username: string, password: string): Promise<void> {
    // Insert user directly via signup with a known captcha
    const client = await getTestClient();
    const id = crypto.randomUUID();
    const data = { type: "arithmetic", question: "What is 2 + 3?" };
    const answer = "5";
    const encoded = new TextEncoder().encode(answer.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await client.queryArray(
      `INSERT INTO captcha_challenges (id, challenge_data, answer_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [id, JSON.stringify(data), hashHex, expiresAt],
    );

    const res = await handleSignup(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          captcha_id: id,
          captcha_answer: answer,
        }),
      }),
    );
    assertEquals(res.status, 201);
  }

  it("rejects invalid JSON", async () => {
    const res = await handleLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Invalid JSON");
  });

  it("rejects missing fields", async () => {
    const res = await handleLogin(loginRequest({ username: "alice" }));
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("Missing required fields"), true);
  });

  it("rejects nonexistent user", async () => {
    const res = await handleLogin(loginRequest({
      username: testUsername("nonexistent"),
      password: "password123",
    }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Invalid username or password");
  });

  it("rejects wrong password", async () => {
    const uname = testUsername("login_wrongpw");
    await signupUser(uname, "correctpass123");

    const res = await handleLogin(loginRequest({
      username: uname,
      password: "wrongpassword",
    }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Invalid username or password");
  });

  it("logs in with valid credentials and sets session cookie", async () => {
    const uname = testUsername("login_ok");
    const pw = "validpass123";
    await signupUser(uname, pw);

    const res = await handleLogin(loginRequest({ username: uname, password: pw }));
    assertEquals(res.status, 200);

    const body = await res.json();
    assertExists(body.user);
    assertEquals(body.user.username, uname);
    // Token must NOT be in response body
    assertEquals(body.session_token, undefined);
    assertEquals(body.session, undefined);

    // Check Set-Cookie header
    const setCookie = res.headers.get("Set-Cookie");
    assertExists(setCookie);
    assertEquals(setCookie!.includes(`${SESSION_COOKIE_NAME}=`), true);
    assertEquals(setCookie!.includes("HttpOnly"), true);

    // Validate session exists in DB
    const tokenMatch = setCookie!.match(/session=([a-f0-9]+)/);
    assertExists(tokenMatch);
    const userId = await validateSession(tokenMatch![1]);
    assertEquals(userId, body.user.id);
  });

  it("logout destroys session and clears cookie", async () => {
    const uname = testUsername("login_logout");
    const pw = "logoutpass123";
    await signupUser(uname, pw);

    // Login first
    const loginRes = await handleLogin(loginRequest({ username: uname, password: pw }));
    const setCookie = loginRes.headers.get("Set-Cookie")!;
    const tokenMatch = setCookie.match(/session=([a-f0-9]+)/)!;
    const token = tokenMatch[1];

    // Verify session is valid
    const userId = await validateSession(token);
    assertExists(userId);

    // Logout
    const logoutRes = await handleLogout(
      new Request("http://localhost/api/auth/logout", {
        method: "DELETE",
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    assertEquals(logoutRes.status, 204);

    // Cookie should be cleared
    const clearCookie = logoutRes.headers.get("Set-Cookie");
    assertExists(clearCookie);
    assertEquals(clearCookie!.includes("Max-Age=0"), true);

    // Session should no longer be valid in DB
    const userIdAfter = await validateSession(token);
    assertEquals(userIdAfter, null);
  });

  it("me returns current user when authenticated", async () => {
    const uname = testUsername("login_me");
    const pw = "mepass123";
    await signupUser(uname, pw);

    // Login to get session
    const loginRes = await handleLogin(loginRequest({ username: uname, password: pw }));
    const setCookie = loginRes.headers.get("Set-Cookie")!;
    const tokenMatch = setCookie.match(/session=([a-f0-9]+)/)!;
    const token = tokenMatch[1];

    // Call /me
    const meRes = await handleMe(
      new Request("http://localhost/api/auth/me", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    assertEquals(meRes.status, 200);
    const body = await meRes.json();
    assertEquals(body.user.username, uname);
  });

  it("me returns 401 without valid session", async () => {
    const meRes = await handleMe(
      new Request("http://localhost/api/auth/me", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=invalidtoken` },
      }),
    );
    assertEquals(meRes.status, 401);
  });
});
