// Profile update endpoint.
// Authenticated users can update their display_name and about fields.

import { STATUS_CODE } from "../deps.ts";
import { queryOne } from "../db.ts";
import { requireAuth, type AuthContext } from "./middleware.ts";

interface ProfileBody {
  display_name?: string | null;
  about?: string | null;
}

/** PATCH /api/auth/profile */
export const handleUpdateProfile = requireAuth(async (req: Request, ctx: AuthContext) => {
  let body: ProfileBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", STATUS_CODE.BadRequest);
  }

  const updates: string[] = [];
  const args: unknown[] = [];
  let argIdx = 1;

  if ("display_name" in body) {
    updates.push(`display_name = $${argIdx++}`);
    args.push(body.display_name ?? null);
  }
  if ("about" in body) {
    updates.push(`about = $${argIdx++}`);
    args.push(body.about ?? null);
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", STATUS_CODE.BadRequest);
  }

  args.push(ctx.userId);
  const user = await queryOne<{ id: string; username: string; display_name: string | null; about: string | null; avatar_path: string | null }>(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${argIdx}
     RETURNING id, username, display_name, about, avatar_path`,
    args,
  );

  if (!user) {
    return errorResponse("User not found", STATUS_CODE.InternalServerError);
  }

  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        about: user.about,
        avatar_path: user.avatar_path,
      },
    }),
    { status: STATUS_CODE.OK, headers: { "Content-Type": "application/json" } },
  );
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
