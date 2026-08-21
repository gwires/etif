// Local account signup with captcha verification.
// Passwords hashed with PBKDF2-SHA256 (600k iterations) via Web Crypto API.
// Session token delivered via http-only cookie only — never in response body.

import { STATUS_CODE, encodeHex } from "../deps.ts";
import { queryOne, execute } from "../db.ts";
import { verifyCaptcha } from "./captcha.ts";
import { createSession, sessionCookieHeader } from "./session.ts";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const PBKDF2_ITERATIONS = 600_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

interface SignupBody {
  username?: string;
  password?: string;
  captcha_id?: string;
  captcha_answer?: string;
}

/** POST /api/auth/signup */
export async function handleSignup(req: Request): Promise<Response> {
  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", STATUS_CODE.BadRequest);
  }

  const { username, password, captcha_id, captcha_answer } = body;

  // Validate required fields
  if (!username || !password || !captcha_id || !captcha_answer) {
    return errorResponse("Missing required fields: username, password, captcha_id, captcha_answer", STATUS_CODE.BadRequest);
  }

  // Verify captcha first (fail fast on bot)
  const captchaValid = await verifyCaptcha(captcha_id, captcha_answer);
  if (!captchaValid) {
    return errorResponse("Captcha verification failed", STATUS_CODE.BadRequest);
  }

  // Validate username format
  if (!USERNAME_RE.test(username)) {
    return errorResponse(
      "Username must be 3-32 characters, alphanumeric and underscore only",
      STATUS_CODE.BadRequest,
    );
  }

  // Validate password length
  if (password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      STATUS_CODE.BadRequest,
    );
  }

  // Check username availability
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE username = $1",
    [username],
  );
  if (existing) {
    return errorResponse("Username already taken", STATUS_CODE.Conflict);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Insert user
  const user = await queryOne<{ id: string; username: string }>(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
    [username, passwordHash],
  );

  if (!user) {
    return errorResponse("Failed to create user", STATUS_CODE.InternalServerError);
  }

  // Create session and set cookie
  const token = await createSession(user.id);

  return new Response(
    JSON.stringify({ user: { id: user.id, username: user.username } }),
    {
      status: STATUS_CODE.Created,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookieHeader(token),
      },
    },
  );
}

/** Hash a password using PBKDF2-SHA256. Returns "pbkdf2-sha256$iterations$salt$hash" in hex. */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    HASH_BYTES * 8,
  );
  const hash = new Uint8Array(derivedBits);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${encodeHex(salt)}$${encodeHex(hash)}`;
}

/** Verify a password against a stored hash string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;

  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expectedHash = parts[3];

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  );
  const actualHash = encodeHex(new Uint8Array(derivedBits));

  // Constant-time comparison
  if (actualHash.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actualHash.length; i++) {
    mismatch |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
