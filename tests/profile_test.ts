// Integration tests for profile update, avatar upload/delete, and /me profile fields.

import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { handleSignup } from "../api/auth/signup.ts";
import { handleMe } from "../api/auth/middleware.ts";
import { handleUpdateProfile } from "../api/auth/profile.ts";
import { handleUploadAvatar, handleDeleteAvatar, handleServeAvatar } from "../api/auth/avatar.ts";
import { SESSION_COOKIE_NAME } from "../api/auth/session.ts";
import { closePool } from "../api/db.ts";

describe("auth/profile", { sanitizeOps: false, sanitizeResources: false }, () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await getTestClient();
    // Sign up a test user and capture the session cookie
    const client = await getTestClient();
    const crypto_ = globalThis.crypto;
    const id = crypto_.randomUUID();
    const data = { type: "arithmetic", question: "What is 2 + 3?" };
    const answer = "5";
    const encoded = new TextEncoder().encode(answer.toLowerCase().trim());
    const hashBuffer = await crypto_.subtle.digest("SHA-256", encoded);
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
          username: testUsername("profile"),
          password: "password123",
          captcha_id: id,
          captcha_answer: answer,
        }),
      }),
    );
    const setCookie = res.headers.get("Set-Cookie");
    const match = setCookie!.match(/session=([a-f0-9]+)/);
    sessionCookie = `${SESSION_COOKIE_NAME}=${match![1]}`;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  function authReq(method: string, path: string, body?: unknown): Request {
    return new Request(`http://localhost${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  it("GET /me returns profile fields (initially null)", async () => {
    const res = await handleMe(authReq("GET", "/api/auth/me"));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.display_name, null);
    assertEquals(body.user.about, null);
    assertEquals(body.user.avatar_path, null);
  });

  it("PATCH /profile updates display_name and about", async () => {
    const res = await handleUpdateProfile(
      authReq("PATCH", "/api/auth/profile", {
        display_name: "Test User",
        about: "A test account",
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.display_name, "Test User");
    assertEquals(body.user.about, "A test account");
  });

  it("PATCH /profile with only one field", async () => {
    const res = await handleUpdateProfile(
      authReq("PATCH", "/api/auth/profile", { display_name: "Updated Name" }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.display_name, "Updated Name");
    assertEquals(body.user.about, "A test account"); // unchanged
  });

  it("PATCH /profile rejects empty body", async () => {
    const res = await handleUpdateProfile(
      authReq("PATCH", "/api/auth/profile", {}),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "No fields to update");
  });

  it("PATCH /profile can clear fields with null", async () => {
    const res = await handleUpdateProfile(
      authReq("PATCH", "/api/auth/profile", { display_name: null, about: null }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.display_name, null);
    assertEquals(body.user.about, null);
  });

  it("POST /avatar uploads valid PNG", async () => {
    // Minimal valid PNG (1x1 transparent pixel)
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, // IEND chunk
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
      0x60, 0x82,
    ]);

    const formData = new FormData();
    formData.append("avatar", new File([pngBytes], "test.png", { type: "image/png" }));

    const res = await handleUploadAvatar(
      new Request("http://localhost/api/auth/avatar", {
        method: "POST",
        headers: { Cookie: sessionCookie },
        body: formData,
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertExists(body.avatar_path);
    assertEquals(body.avatar_path.endsWith(".png"), true);
  });

  it("POST /avatar rejects oversized file", async () => {
    const bigBytes = new Uint8Array(500 * 1024 + 1);
    // Set PNG magic bytes so it passes type check but fails size check
    bigBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const formData = new FormData();
    formData.append("avatar", new File([bigBytes], "big.png", { type: "image/png" }));

    const res = await handleUploadAvatar(
      new Request("http://localhost/api/auth/avatar", {
        method: "POST",
        headers: { Cookie: sessionCookie },
        body: formData,
      }),
    );

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("too large"), true);
  });

  it("POST /avatar rejects invalid image type", async () => {
    const notImage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);

    const formData = new FormData();
    formData.append("avatar", new File([notImage], "test.txt", { type: "text/plain" }));

    const res = await handleUploadAvatar(
      new Request("http://localhost/api/auth/avatar", {
        method: "POST",
        headers: { Cookie: sessionCookie },
        body: formData,
      }),
    );

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("Invalid image type"), true);
  });

  it("DELETE /avatar removes avatar", async () => {
    const res = await handleDeleteAvatar(
      new Request("http://localhost/api/auth/avatar", {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }),
    );
    assertEquals(res.status, 204);

    // Verify /me shows null avatar
    const meRes = await handleMe(authReq("GET", "/api/auth/me"));
    const body = await meRes.json();
    assertEquals(body.user.avatar_path, null);
  });

  it("GET /avatars/:filename serves uploaded file", async () => {
    // Upload first
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
      0x60, 0x82,
    ]);

    const formData = new FormData();
    formData.append("avatar", new File([pngBytes], "test.png", { type: "image/png" }));

    const uploadRes = await handleUploadAvatar(
      new Request("http://localhost/api/auth/avatar", {
        method: "POST",
        headers: { Cookie: sessionCookie },
        body: formData,
      }),
    );
    const { avatar_path } = await uploadRes.json();

    // Serve the file
    const serveRes = await handleServeAvatar(
      new Request(`http://localhost/avatars/${avatar_path}`),
    );
    assertEquals(serveRes.status, 200);
    assertEquals(serveRes.headers.get("Content-Type"), "image/png");
    assertEquals(serveRes.headers.get("Cache-Control"), "public, max-age=86400");
  });

  it("GET /avatars/:filename rejects path traversal", async () => {
    const res = await handleServeAvatar(
      new Request("http://localhost/avatars/../etc/passwd"),
    );
    assertEquals(res.status, 404);
  });

  it("GET /avatars/:filename returns 404 for missing file", async () => {
    const res = await handleServeAvatar(
      new Request("http://localhost/avatars/nonexistent.png"),
    );
    assertEquals(res.status, 404);
  });
});
