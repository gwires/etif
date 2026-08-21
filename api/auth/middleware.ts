// Session validation middleware and auth-dependent route handlers.
// Reads session cookie, validates against DB, attaches user_id to context.

import { STATUS_CODE, getCookies } from "../deps.ts";
import { validateSession, deleteSession, clearSessionCookieHeader, SESSION_COOKIE_NAME } from "./session.ts";
import { queryOne } from "../db.ts";

/** Extended request context carrying authenticated user info. */
export interface AuthContext {
  userId: string;
  username: string;
}

/** Extract and validate session from request. Returns auth context or null. */
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookies = getCookies(req.headers);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const userId = await validateSession(token);
  if (!userId) return null;

  const user = await queryOne<{ username: string }>(
    "SELECT username FROM users WHERE id = $1",
    [userId],
  );
  if (!user) return null;

  return { userId, username: user.username };
}

/** Middleware wrapper: rejects unauthenticated requests with 401. */
export function requireAuth(
  handler: (req: Request, ctx: AuthContext) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: STATUS_CODE.Unauthorized,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(req, ctx);
  };
}

/** GET /api/auth/me — returns current user info. */
export const handleMe = requireAuth((_req, ctx) => {
  return new Response(
    JSON.stringify({ user: { id: ctx.userId, username: ctx.username } }),
    { status: STATUS_CODE.OK, headers: { "Content-Type": "application/json" } },
  );
});

/** DELETE /api/auth/logout — destroys session and clears cookie. */
export async function handleLogout(req: Request): Promise<Response> {
  const cookies = getCookies(req.headers);
  const token = cookies[SESSION_COOKIE_NAME];

  if (token) {
    await deleteSession(token);
  }

  return new Response(null, {
    status: STATUS_CODE.NoContent,
    headers: { "Set-Cookie": clearSessionCookieHeader() },
  });
}
