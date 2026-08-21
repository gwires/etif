// DB queries for votes.

import { queryOne } from "../db.ts";

const VALID_TARGET_TYPES = ["issue", "comment"];

export function isValidTargetType(t: string): boolean {
  return VALID_TARGET_TYPES.includes(t);
}

/** Get existing vote for this user+target, if any. */
export async function getVote(
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ value: number } | null> {
  return queryOne<{ value: number }>(
    "SELECT value FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3",
    [userId, targetType, targetId],
  );
}

/** Insert a new vote. */
export async function insertVote(
  userId: string,
  targetType: string,
  targetId: string,
  value: number,
): Promise<void> {
  await queryOne(
    "INSERT INTO votes (user_id, target_type, target_id, value) VALUES ($1, $2, $3, $4)",
    [userId, targetType, targetId, value],
  );
}

/** Update an existing vote's value. */
export async function updateVote(
  userId: string,
  targetType: string,
  targetId: string,
  value: number,
): Promise<void> {
  await queryOne(
    "UPDATE votes SET value = $4 WHERE user_id = $1 AND target_type = $2 AND target_id = $3",
    [userId, targetType, targetId, value],
  );
}

/** Delete a vote. */
export async function deleteVote(
  userId: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  await queryOne(
    "DELETE FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3",
    [userId, targetType, targetId],
  );
}

/** Recompute and cache score on the target table. */
export async function updateCachedScore(
  targetType: string,
  targetId: string,
): Promise<number> {
  const row = await queryOne<{ score: number }>(
    `UPDATE ${targetType === "issue" ? "issues" : "comments"}
     SET score = (SELECT COALESCE(SUM(value), 0) FROM votes WHERE target_type = $1 AND target_id = $2)
     WHERE id = $2 RETURNING score`,
    [targetType, targetId],
  );
  return row?.score ?? 0;
}

/** Check if a target exists. */
export async function targetExists(
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const table = targetType === "issue" ? "issues" : "comments";
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = $1`,
    [targetId],
  );
  return row !== null;
}
