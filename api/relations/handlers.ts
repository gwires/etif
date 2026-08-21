// HTTP handlers for /api/issues/:id/relations and /api/relations/:id endpoints.

import { STATUS_CODE } from "../deps.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import {
  getRelationsForIssue,
  createRelation,
  getRelation,
  updateRelationBody,
  deleteRelation,
  issueExists,
  isValidRelationType,
} from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/issues/:id/relations — list incoming + outgoing relations (auth required) */
export const handleGetRelations = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/issues/:id/relations → parts[3] is the issue id
  const issueId = parts[3];

  const exists = await issueExists(issueId);
  if (!exists) return json({ error: "Not found" }, STATUS_CODE.NotFound);

  const relations = await getRelationsForIssue(issueId);
  return json(relations);
});

/** POST /api/issues/:id/relations — create a relation (auth required) */
export const handleCreateRelation = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/issues/:id/relations → parts[3] is the issue id
  const sourceId = parts[3];

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const targetId = typeof body.target_id === "string" ? body.target_id : null;
  if (!targetId) return json({ error: "target_id is required" }, STATUS_CODE.BadRequest);

  const relationType = typeof body.relation_type === "string" ? body.relation_type : null;
  if (!relationType || !isValidRelationType(relationType)) {
    return json({ error: "valid relation_type is required (causes, parent_of, related_to)" }, STATUS_CODE.BadRequest);
  }

  const relationBody = typeof body.body === "string" ? body.body : null;

  // Validate both issues exist
  if (!(await issueExists(sourceId))) {
    return json({ error: "Source issue not found" }, STATUS_CODE.NotFound);
  }
  if (!(await issueExists(targetId))) {
    return json({ error: "Target issue not found" }, STATUS_CODE.NotFound);
  }

  try {
    const relation = await createRelation(sourceId, targetId, relationType, relationBody);
    return json(relation, STATUS_CODE.Created);
  } catch (err) {
    // Unique constraint violation
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return json({ error: "Relation already exists" }, STATUS_CODE.Conflict);
    }
    throw err;
  }
});

/** PATCH /api/relations/:id — update relation body (auth required) */
export const handleUpdateRelation = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 1];

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const existing = await getRelation(id);
  if (!existing) return json({ error: "Not found" }, STATUS_CODE.NotFound);

  const relationBody = typeof body.body === "string" ? body.body : null;
  const updated = await updateRelationBody(id, relationBody);
  return json(updated);
});

/** DELETE /api/relations/:id — delete a relation (auth required) */
export const handleDeleteRelation = requireAuth(async (_req: Request, _ctx: AuthContext) => {
  const url = new URL(_req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 1];

  const existing = await getRelation(id);
  if (!existing) return json({ error: "Not found" }, STATUS_CODE.NotFound);

  await deleteRelation(id);
  return new Response(null, { status: STATUS_CODE.NoContent });
});
