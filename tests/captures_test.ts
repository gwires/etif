import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool } from "../api/db.ts";
import {
  handleListCaptures,
  handleCreateCapture,
  handleGetCapture,
  handleUpdateCapture,
  handleDeleteCapture,
  handleListUrls,
} from "../api/captures/handlers.ts";

/** Create a user and return session cookie header string. */
async function createTestUser(suffix: string): Promise<{ cookie: string; userId: string }> {
  const client = await getTestClient();
  const username = testUsername(suffix);

  await client.queryArray(
    `INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), $1, 'fakehash')`,
    [username],
  );
  const user = await client.queryObject<{ id: string }>(
    "SELECT id FROM users WHERE username = $1",
    [username],
  );
  const userId = user.rows[0].id;

  // Insert session with hashed token (matches real schema)
  const token = `test-session-${suffix}-${Date.now()}`;
  const tokenHash = encodeHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  await client.queryArray(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
    [userId, tokenHash],
  );

  return { cookie: `session=${token}`, userId };
}

function encodeHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function captureRequest(path: string, opts: { method?: string; cookie: string; body?: unknown }): Request {
  return new Request(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      Cookie: opts.cookie,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

describe("Captures API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let auth: { cookie: string; userId: string };

  beforeAll(async () => {
    await cleanupTestData();
    auth = await createTestUser("captures");
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });

  it("requires auth", async () => {
    const res = await handleListCaptures(new Request("http://localhost/api/captures"));
    assertEquals(res.status, 401);
  });

  it("creates a capture", async () => {
    const res = await handleCreateCapture(captureRequest("/api/captures", {
      method: "POST",
      cookie: auth.cookie,
      body: {
        title: "_test_ capture one",
        status: "**",
        what_text: "Check https://example.com for details",
        notes: "[link](https://notes.org)",
      },
    }));
    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.capture.title, "_test_ capture one");
    assertEquals(data.capture.status, "**");
    assertNotEquals(data.capture.id, undefined);
  });

  it("lists captures", async () => {
    const res = await handleListCaptures(captureRequest("/api/captures", { cookie: auth.cookie }));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.captures.length >= 1, true);
  });

  it("filters by status", async () => {
    const res = await handleListCaptures(captureRequest("/api/captures?status=***", { cookie: auth.cookie }));
    const data = await res.json();
    for (const c of data.captures) {
      assertEquals(c.status, "***");
    }
  });

  it("gets a single capture with URLs extracted", async () => {
    const create = await handleCreateCapture(captureRequest("/api/captures", {
      method: "POST",
      cookie: auth.cookie,
      body: { title: "_test_ get capture", what_text: "Visit https://get-test.com" },
    }));
    const created = await create.json();
    const id = created.capture.id;

    const res = await handleGetCapture(captureRequest(`/api/captures/${id}`, { cookie: auth.cookie }));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.capture.id, id);
    assertEquals(data.capture.images, []);
  });

  it("updates a capture and re-extracts URLs", async () => {
    const create = await handleCreateCapture(captureRequest("/api/captures", {
      method: "POST",
      cookie: auth.cookie,
      body: { title: "_test_ update me", what_text: "https://old.com" },
    }));
    const created = await create.json();
    const id = created.capture.id;

    const res = await handleUpdateCapture(captureRequest(`/api/captures/${id}`, {
      method: "PATCH",
      cookie: auth.cookie,
      body: { what_text: "https://new.com" },
    }));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.capture.what_text, "https://new.com");
  });

  it("deletes a capture", async () => {
    const create = await handleCreateCapture(captureRequest("/api/captures", {
      method: "POST",
      cookie: auth.cookie,
      body: { title: "_test_ delete me" },
    }));
    const created = await create.json();
    const id = created.capture.id;

    const res = await handleDeleteCapture(captureRequest(`/api/captures/${id}`, {
      method: "DELETE",
      cookie: auth.cookie,
    }));
    assertEquals(res.status, 204);

    // Verify gone
    const get = await handleGetCapture(captureRequest(`/api/captures/${id}`, { cookie: auth.cookie }));
    assertEquals(get.status, 404);
  });

  it("rejects empty title on create", async () => {
    const res = await handleCreateCapture(captureRequest("/api/captures", {
      method: "POST",
      cookie: auth.cookie,
      body: { title: "" },
    }));
    assertEquals(res.status, 400);
  });

  it("returns 404 for non-existent capture", async () => {
    const res = await handleGetCapture(captureRequest("/api/captures/00000000-0000-0000-0000-000000000000", {
      cookie: auth.cookie,
    }));
    assertEquals(res.status, 404);
  });

  it("lists aggregated URLs", async () => {
    const res = await handleListUrls(captureRequest("/api/urls", { cookie: auth.cookie }));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(Array.isArray(data.urls), true);
  });
});
