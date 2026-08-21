// HTTP handlers for /api/issues endpoints.
// Thin layer: parse request → call queries → format response.

import { STATUS_CODE } from "../deps.ts";
import { requireAuth, getAuthContext, type AuthContext } from "../auth/middleware.ts";
import { listIssues, getIssue, createIssue, updateIssue } from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clampInt(val: string | null, def: number, min: number, max: number): number {
  if (!val) return def;
  const n = parseInt(val, 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

/** GET /api/issues — public list with filtering/pagination */
export async function handleListIssues(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.searchParams;

  const result = await listIssues({
    type: p.get("type") ?? undefined,
    status: p.get("status") ?? undefined,
    severity: p.get("severity") ? parseInt(p.get("severity")!, 10) : undefined,
    tag: p.get("tag") ?? undefined,
    region: p.get("region") ?? undefined,
    sort: p.get("sort") ?? undefined,
    order: p.get("order") ?? undefined,
    limit: clampInt(p.get("limit"), 50, 1, 200),
    offset: clampInt(p.get("offset"), 0, 0, 1_000_000),
  });

  return json(result);
}

/** POST /api/issues — create a new issue (auth required) */
export const handleCreateIssue = requireAuth(async (req: Request, ctx: AuthContext) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  if (!title) return json({ error: "title is required" }, STATUS_CODE.BadRequest);

  const issueBody = typeof body.body === "string" ? body.body : null;
  const severity = typeof body.severity === "number" && body.severity >= 1 && body.severity <= 5
    ? body.severity
    : null;

  const issue = await createIssue(ctx.userId, title, issueBody, severity);
  return json(issue, STATUS_CODE.Created);
});

/** GET /api/issues/:id — public single issue detail */
export async function handleGetIssue(req: Request, id: string): Promise<Response> {
  const issue = await getIssue(id);
  if (!issue) return json({ error: "Not found" }, STATUS_CODE.NotFound);
  return json(issue);
}

/** PATCH /api/issues/:id — update issue fields (auth required) */
export const handleUpdateIssue = requireAuth(async (req: Request, _ctx: AuthContext) => {
  // Extract id from URL path
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 1];

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const fields: Record<string, unknown> = {};
  if (typeof body.title === "string") fields.title = body.title.trim();
  if (typeof body.body === "string") fields.body = body.body;
  if (typeof body.severity === "number") fields.severity = body.severity;
  if (typeof body.status === "string") fields.status = body.status;
  if (typeof body.type === "string") fields.type = body.type;

  const existing = await getIssue(id);
  if (!existing) return json({ error: "Not found" }, STATUS_CODE.NotFound);

  const updated = await updateIssue(id, fields);
  return json(updated);
});
