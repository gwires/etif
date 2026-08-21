// Session management: create, validate, and destroy sessions.
// Sessions use opaque 32-byte random tokens, stored as SHA-256 hashes in DB.
// Tokens are delivered via http-only cookies only — never in response bodies.

import { encodeHex } from "../deps.ts";
import { queryOne, execute } from "../db.ts";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const SESSION_COOKIE_NAME = "session";

/** Create a session for a user. Returns the raw token (for cookie setting). */
export async function createSession(userId: string): Promise<string> {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = encodeHex(tokenBytes);

  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await execute(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return token;
}

/** Validate a session token. Returns the user_id if valid, null otherwise. */
export async function validateSession(token: string): Promise<string | null> {
  const tokenHash = await hashToken(token);
  const row = await queryOne<{ user_id: string; expires_at: Date }>(
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  );

  if (!row) return null;
  if (new Date() > new Date(row.expires_at)) {
    // Clean up expired session
    await execute("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }

  return row.user_id;
}

/** Delete a session by token. Used for logout. */
export async function deleteSession(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await execute("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

/** Build a Set-Cookie header value for the session token. */
export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

/** Build a Set-Cookie header that clears the session cookie. */
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return encodeHex(hashBuffer);
}
