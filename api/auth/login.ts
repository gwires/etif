// Local account login.
// Verifies credentials, creates session, sets http-only cookie.
// Session token delivered via cookie only — never in response body.

import { STATUS_CODE } from "../deps.ts";
import { queryOne } from "../db.ts";
import { verifyPassword } from "./signup.ts";
import { createSession, sessionCookieHeader } from "./session.ts";

interface LoginBody {
  username?: string;
  password?: string;
}

/** POST /api/auth/login */
export async function handleLogin(req: Request): Promise<Response> {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", STATUS_CODE.BadRequest);
  }

  const { username, password } = body;

  if (!username || !password) {
    return errorResponse(
      "Missing required fields: username, password",
      STATUS_CODE.BadRequest,
    );
  }

  // Look up user by username
  const user = await queryOne<{ id: string; username: string; password_hash: string }>(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username],
  );

  if (!user) {
    // Use generic message to avoid username enumeration
    return errorResponse("Invalid username or password", STATUS_CODE.Unauthorized);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return errorResponse("Invalid username or password", STATUS_CODE.Unauthorized);
  }

  // Create session and set cookie
  const token = await createSession(user.id);

  return new Response(
    JSON.stringify({ user: { id: user.id, username: user.username } }),
    {
      status: STATUS_CODE.OK,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookieHeader(token),
      },
    },
  );
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
