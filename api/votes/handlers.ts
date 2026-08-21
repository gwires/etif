// HTTP handlers for /api/votes endpoints.

import { STATUS_CODE } from "../deps.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import {
  isValidTargetType,
  getVote,
  insertVote,
  updateVote,
  deleteVote,
  updateCachedScore,
  targetExists,
} from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /api/votes — upsert or toggle a vote (auth required) */
export const handleVote = requireAuth(async (req: Request, ctx: AuthContext) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const targetType = typeof body.target_type === "string" ? body.target_type : "";
  const targetId = typeof body.target_id === "string" ? body.target_id : "";
  const value = body.value;

  if (!isValidTargetType(targetType)) {
    return json({ error: "Invalid target_type" }, STATUS_CODE.BadRequest);
  }
  if (!targetId) {
    return json({ error: "target_id is required" }, STATUS_CODE.BadRequest);
  }
  if (value !== 1 && value !== -1) {
    return json({ error: "value must be 1 or -1" }, STATUS_CODE.BadRequest);
  }

  if (!(await targetExists(targetType, targetId))) {
    return json({ error: "Target not found" }, STATUS_CODE.NotFound);
  }

  const existing = await getVote(ctx.userId, targetType, targetId);

  let action: string;
  if (!existing) {
    await insertVote(ctx.userId, targetType, targetId, value);
    action = "created";
  } else if (existing.value === value) {
    // Same value → toggle off
    await deleteVote(ctx.userId, targetType, targetId);
    action = "deleted";
  } else {
    await updateVote(ctx.userId, targetType, targetId, value);
    action = "updated";
  }

  const newScore = await updateCachedScore(targetType, targetId);
  return json({ action, new_score: newScore }, STATUS_CODE.OK);
});
