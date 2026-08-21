import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { getTestClient, closeTestClient, cleanupTestData, testUsername } from "./helpers.ts";
import { closePool } from "../api/db.ts";
import { handleUploadImage, handleDeleteImage, handleServeImage } from "../api/captures/images.ts";

// Minimal valid PNG (1x1 pixel)
const MINIMAL_PNG = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
  0x44, 0xAE, 0x42, 0x60, 0x82,
]);

// Minimal valid JPEG
const MINIMAL_JPEG = new Uint8Array([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
]);

function buildMultipart(boundary: string, fileData: Uint8Array, filename: string, contentType: string, caption?: string): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  parts.push(encoder.encode(`--${boundary}\r\n`));
  parts.push(encoder.encode(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
  parts.push(encoder.encode(`Content-Type: ${contentType}\r\n\r\n`));
  parts.push(fileData);
  parts.push(encoder.encode("\r\n"));

  if (caption !== undefined) {
    parts.push(encoder.encode(`--${boundary}\r\n`));
    parts.push(encoder.encode(`Content-Disposition: form-data; name="caption"\r\n\r\n`));
    parts.push(encoder.encode(caption));
    parts.push(encoder.encode("\r\n"));
  }

  parts.push(encoder.encode(`--${boundary}--\r\n`));

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function createTestUserWithCapture(): Promise<{ cookie: string; captureId: string }> {
  const client = await getTestClient();
  const username = testUsername("images");

  await client.queryArray(
    `INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), $1, 'fakehash')`,
    [username],
  );
  const user = await client.queryObject<{ id: string }>(
    "SELECT id FROM users WHERE username = $1",
    [username],
  );
  const userId = user.rows[0].id;

  const token = `test-session-images-${Date.now()}`;
  const tokenHash = encodeHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  await client.queryArray(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
    [userId, tokenHash],
  );

  const capture = await client.queryObject<{ id: string }>(
    `INSERT INTO captures (user_id, title) VALUES ($1, '_test_ image capture') RETURNING id`,
    [userId],
  );

  return { cookie: `session=${token}`, captureId: capture.rows[0].id };
}

function encodeHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Captures Images API", { sanitizeOps: false, sanitizeResources: false }, () => {
  let auth: { cookie: string; captureId: string };

  beforeAll(async () => {
    await cleanupTestData();
    auth = await createTestUserWithCapture();
  });

  afterAll(async () => {
    await cleanupTestData();
    // Clean up test images
    try {
      for await (const entry of Deno.readDir("./data/images")) {
        if (entry.isFile && entry.name.includes(auth.captureId)) {
          await Deno.remove(`./data/images/${entry.name}`);
        }
      }
    } catch { /* dir may not exist */ }
    await closeTestClient();
    await closePool();
  });

  it("uploads a valid PNG", async () => {
    const boundary = "test-boundary-123";
    const body = buildMultipart(boundary, MINIMAL_PNG, "test.png", "image/png", "A test image");

    const res = await handleUploadImage(new Request(`http://localhost/api/captures/${auth.captureId}/images`, {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }));

    assertEquals(res.status, 201);
    const data = await res.json();
    assertEquals(data.image.caption, "A test image");
    assertEquals(data.image.sort_order, 0);
  });

  it("rejects wrong MIME type", async () => {
    const boundary = "test-boundary-456";
    const body = buildMultipart(boundary, MINIMAL_PNG, "test.txt", "text/plain");

    const res = await handleUploadImage(new Request(`http://localhost/api/captures/${auth.captureId}/images`, {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }));

    assertEquals(res.status, 400);
  });

  it("rejects mismatched magic bytes", async () => {
    const boundary = "test-boundary-789";
    const body = buildMultipart(boundary, MINIMAL_JPEG, "fake.png", "image/png");

    const res = await handleUploadImage(new Request(`http://localhost/api/captures/${auth.captureId}/images`, {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }));

    assertEquals(res.status, 400);
  });

  it("deletes an image", async () => {
    // Upload first
    const boundary = "test-boundary-del";
    const body = buildMultipart(boundary, MINIMAL_PNG, "del.png", "image/png");
    const upload = await handleUploadImage(new Request(`http://localhost/api/captures/${auth.captureId}/images`, {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }));
    const uploaded = await upload.json();
    const imgId = uploaded.image.id;

    const res = await handleDeleteImage(new Request(`http://localhost/api/captures/${auth.captureId}/images/${imgId}`, {
      method: "DELETE",
      headers: { Cookie: auth.cookie },
    }));
    assertEquals(res.status, 204);
  });

  it("serves uploaded images without auth", async () => {
    // Upload
    const boundary = "test-boundary-serve";
    const body = buildMultipart(boundary, MINIMAL_PNG, "serve.png", "image/png");
    const upload = await handleUploadImage(new Request(`http://localhost/api/captures/${auth.captureId}/images`, {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }));
    const uploaded = await upload.json();
    const filename = uploaded.image.path.split("/").pop();

    const res = await handleServeImage(new Request(`http://localhost/images/${filename}`));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "image/png");
  });
});
