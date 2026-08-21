// Integration tests for local signup flow.
// Tests captcha integration, validation, duplicate detection, and session creation.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertNotEquals, assertExists } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { handleSignup } from "../api/auth/signup.ts";
import { generateCaptcha } from "../api/auth/captcha.ts";
import { validateSession, SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { queryOne } from "../api/db.ts";
import { closePool } from "../api/db.ts";

describe("auth/signup", { sanitizeOps: false, sanitizeResources: false }, () => {
  beforeAll(async () => {
    await getTestClient();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  async function signupWith(body: Record<string, unknown>): Promise<Response> {
    return handleSignup(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  async function freshCaptcha(): Promise<{ id: string; answer: string }> {
    // Generate a captcha and look up its answer from DB for testing
    const captcha = await generateCaptcha();
    const client = await getTestClient();
    const result = await client.queryObject<{ challenge_data: string }>(
      "SELECT challenge_data FROM captcha_challenges WHERE id = $1",
      [captcha.id],
    );
    const data = JSON.parse(result.rows[0].challenge_data);
    // Compute answer based on challenge type
    let answer: string;
    if (data.type === "arithmetic") {
      // Parse the question to compute the answer
      const match = data.question.match(/What is (.+)\?/);
      answer = String(eval(match![1]));
    } else if (data.type === "reverse_text") {
      const match = data.question.match(/'(\w+)'/);
      answer = [...match![1]].reverse().join("");
    } else {
      // word_logic — extract odd one from known sets
      // Just query the hash and try common answers — simpler to re-generate
      // Actually, we can't easily reverse the hash. Let's just delete this captcha
      // and create an arithmetic one by brute-forcing until we get arithmetic.
      // Simpler approach: directly insert a known captcha for testing.
      throw new Error("Non-arithmetic captcha in test — retry");
    }
    return { id: captcha.id, answer };
  }

  async function knownCaptcha(): Promise<{ id: string; answer: string }> {
    // Insert a captcha with a known answer for deterministic testing
    const client = await getTestClient();
    const crypto = globalThis.crypto;
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
    return { id, answer };
  }

  it("rejects invalid JSON", async () => {
    const res = await handleSignup(
      new Request("http://localhost/api/auth/signup", {
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
    const res = await signupWith({ username: "alice" });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("Missing required fields"), true);
  });

  it("rejects bad captcha", async () => {
    const res = await signupWith({
      username: testUsername("badcap"),
      password: "password123",
      captcha_id: crypto.randomUUID(),
      captcha_answer: "wrong",
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Captcha verification failed");
  });

  it("rejects short username", async () => {
    const cap = await knownCaptcha();
    const res = await signupWith({
      username: "ab",
      password: "password123",
      captcha_id: cap.id,
      captcha_answer: cap.answer,
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("3-32 characters"), true);
  });

  it("rejects invalid username characters", async () => {
    const cap = await knownCaptcha();
    const res = await signupWith({
      username: "user name!",
      password: "password123",
      captcha_id: cap.id,
      captcha_answer: cap.answer,
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("alphanumeric"), true);
  });

  it("rejects short password", async () => {
    const cap = await knownCaptcha();
    const res = await signupWith({
      username: testUsername("shortpw"),
      password: "short",
      captcha_id: cap.id,
      captcha_answer: cap.answer,
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("at least 8"), true);
  });

  it("creates user and sets session cookie on valid signup", async () => {
    const cap = await knownCaptcha();
    const uname = testUsername("signup_ok");
    const res = await signupWith({
      username: uname,
      password: "securepass123",
      captcha_id: cap.id,
      captcha_answer: cap.answer,
    });

    assertEquals(res.status, 201);
    const body = await res.json();
    assertExists(body.user);
    assertEquals(body.user.username, uname);
    // Session token must NOT be in response body
    assertEquals(body.session_token, undefined);
    assertEquals(body.session, undefined);

    // Check Set-Cookie header
    const setCookie = res.headers.get("Set-Cookie");
    assertExists(setCookie);
    assertEquals(setCookie!.includes(`${SESSION_COOKIE_NAME}=`), true);
    assertEquals(setCookie!.includes("HttpOnly"), true);

    // Extract token from cookie and validate session exists in DB
    const tokenMatch = setCookie!.match(/session=([a-f0-9]+)/);
    assertExists(tokenMatch);
    const userId = await validateSession(tokenMatch![1]);
    assertEquals(userId, body.user.id);

    // Verify user exists in DB with hashed password
    const dbUser = await queryOne<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE username = $1",
      [uname],
    );
    assertExists(dbUser);
    assertEquals(dbUser!.password_hash!.startsWith("pbkdf2-sha256$"), true);
  });

  it("rejects duplicate username", async () => {
    // First signup succeeds
    const cap1 = await knownCaptcha();
    const uname = testUsername("dup_user");
    await signupWith({
      username: uname,
      password: "password123",
      captcha_id: cap1.id,
      captcha_answer: cap1.answer,
    });

    // Second signup with same username fails
    const cap2 = await knownCaptcha();
    const res = await signupWith({
      username: uname,
      password: "otherpass123",
      captcha_id: cap2.id,
      captcha_answer: cap2.answer,
    });
    assertEquals(res.status, 409);
    const body = await res.json();
    assertEquals(body.error, "Username already taken");
  });

  it("captcha is single-use", async () => {
    const cap = await knownCaptcha();
    const uname1 = testUsername("singleuse1");

    // First use succeeds
    const res1 = await signupWith({
      username: uname1,
      password: "password123",
      captcha_id: cap.id,
      captcha_answer: cap.answer,
    });
    assertEquals(res1.status, 201);

    // Second use of same captcha fails
    const cap2 = await knownCaptcha();
    const uname2 = testUsername("singleuse2");
    const res2 = await signupWith({
      username: uname2,
      password: "password123",
      captcha_id: cap.id, // reuse first captcha
      captcha_answer: cap.answer,
    });
    assertEquals(res2.status, 400);
    const body = await res2.json();
    assertEquals(body.error, "Captcha verification failed");
  });
});
