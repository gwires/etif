// Session validation middleware and auth-dependent route handlers.
// Reads session cookie, validates against DB, attaches user_id to context.

import { STATUS_CODE, getCookies } from "../deps.ts";
import { validateSession, deleteSession, clearSessionCookieHeader, SESSION_COOKIE_NAME } from "./session.ts";
import { queryOne } from "../db.ts";

/** Extended request context carrying authenticated user info. */
export interface AuthContext {
  userId: string;
  username: string;
  displayName: string | null;
  about: string | null;
  avatarPath: string | null;
}

/** Extract and validate session from request. Returns auth context or null. */
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookies = getCookies(req.headers);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const userId = await validateSession(token);
  if (!userId) return null;

  const user = await queryOne<{ username: string; display_name: string | null; about: string | null; avatar_path: string | null }>(
    "SELECT username, display_name, about, avatar_path FROM users WHERE id = $1",
    [userId],
  );
  if (!user) return null;

  return { userId, username: user.username, displayName: user.display_name, about: user.about, avatarPath: user.avatar_path };
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

/** GET /api/auth/me — returns current user info including profile fields. */
export const handleMe = requireAuth((_req, ctx) => {
  return new Response(
    JSON.stringify({
      user: {
        id: ctx.userId,
        username: ctx.username,
        display_name: ctx.displayName,
        about: ctx.about,
        avatar_path: ctx.avatarPath,
      },
    }),
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
