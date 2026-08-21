// HTTP handlers for /api/issues/:id/comments endpoints.

import { STATUS_CODE } from "../deps.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import { listComments, createComment, getComment, issueExists } from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/issues/:id/comments — list comments for an issue (auth required) */
export const handleListComments = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const issueId = parts[3];

  if (!(await issueExists(issueId))) {
    return json({ error: "Not found" }, STATUS_CODE.NotFound);
  }

  const p = url.searchParams;
  const comments = await listComments(
    issueId,
    p.get("sort") ?? undefined,
    p.get("order") ?? undefined,
  );
  return json(comments);
});

/** POST /api/issues/:id/comments — create a comment (auth required) */
export const handleCreateComment = requireAuth(async (req: Request, ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const issueId = parts[3];

  if (!(await issueExists(issueId))) {
    return json({ error: "Issue not found" }, STATUS_CODE.NotFound);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const commentBody = typeof body.body === "string" && body.body.trim() ? body.body.trim() : null;
  if (!commentBody) return json({ error: "body is required" }, STATUS_CODE.BadRequest);

  const parentId = typeof body.parent_comment_id === "string" ? body.parent_comment_id : null;

  // Validate parent comment belongs to same issue
  if (parentId) {
    const parent = await getComment(parentId);
    if (!parent || parent.issue_id !== issueId) {
      return json({ error: "Parent comment not found in this issue" }, STATUS_CODE.BadRequest);
    }
  }

  const comment = await createComment(ctx.userId, issueId, commentBody, parentId);
  return json(comment, STATUS_CODE.Created);
});
