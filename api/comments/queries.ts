// DB queries for comments.

import { query, queryOne } from "../db.ts";

export interface CommentRow {
  [key: string]: unknown;
  id: string;
  issue_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  score: number;
  created_at: string;
  username: string;
}

const VALID_SORTS = ["created_at", "score"];
const VALID_ORDERS = ["asc", "desc"];

export async function listComments(
  issueId: string,
  sort?: string,
  order?: string,
): Promise<CommentRow[]> {
  const col = VALID_SORTS.includes(sort ?? "") ? sort : "created_at";
  const dir = VALID_ORDERS.includes(order ?? "") ? order : "asc";
  return query<CommentRow>(
    `SELECT c.*, u.username FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.issue_id = $1
     ORDER BY c.${col} ${dir}`,
    [issueId],
  );
}

export async function createComment(
  userId: string,
  issueId: string,
  body: string,
  parentCommentId: string | null,
): Promise<CommentRow> {
  return (await query<CommentRow>(
    `INSERT INTO comments (issue_id, user_id, parent_comment_id, body)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [issueId, userId, parentCommentId, body],
  ))[0];
}

export async function getComment(id: string): Promise<CommentRow | null> {
  return queryOne<CommentRow>("SELECT * FROM comments WHERE id = $1", [id]);
}

export async function issueExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>("SELECT id FROM issues WHERE id = $1", [id]);
  return row !== null;
}
