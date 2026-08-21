// DB queries for issues CRUD. Business logic lives here; handlers just parse/format.

import { query, queryOne, execute } from "../db.ts";

export interface IssueRow {
  [key: string]: unknown;
  id: string;
  title: string;
  body: string | null;
  image_path: string | null;
  type: string;
  status: string;
  severity: number | null;
  score: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ListParams {
  type?: string;
  status?: string;
  severity?: number;
  tag?: string;
  region?: string;
  sort?: string;
  order?: string;
  limit: number;
  offset: number;
}

const VALID_SORTS = ["created_at", "score", "updated_at"];
const VALID_ORDERS = ["asc", "desc"];

export async function listIssues(params: ListParams): Promise<IssueRow[]> {
  const conditions: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (params.type) {
    conditions.push(`i.type = $${idx++}`);
    args.push(params.type);
  }
  if (params.status) {
    conditions.push(`i.status = $${idx++}`);
    args.push(params.status);
  }
  if (params.severity != null) {
    conditions.push(`i.severity = $${idx++}`);
    args.push(params.severity);
  }
  if (params.tag) {
    conditions.push(`EXISTS (SELECT 1 FROM issue_tags it JOIN tags t ON t.id = it.tag_id WHERE it.issue_id = i.id AND t.name = $${idx++})`);
    args.push(params.tag);
  }
  if (params.region) {
    conditions.push(`EXISTS (SELECT 1 FROM issue_regions ir WHERE ir.issue_id = i.id AND ir.s2_cell_id = $${idx++})`);
    args.push(BigInt(params.region));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortCol = VALID_SORTS.includes(params.sort ?? "") ? params.sort : "created_at";
  const orderDir = VALID_ORDERS.includes(params.order ?? "") ? params.order : "desc";

  const sql = `SELECT i.* FROM issues i ${where} ORDER BY i.${sortCol} ${orderDir} LIMIT $${idx++} OFFSET $${idx++}`;
  args.push(params.limit, params.offset);

  return query<IssueRow>(sql, args);
}

export async function getIssue(id: string): Promise<IssueRow | null> {
  return queryOne<IssueRow>("SELECT * FROM issues WHERE id = $1", [id]);
}

export async function createIssue(
  userId: string,
  title: string,
  body: string | null,
  severity: number | null,
): Promise<IssueRow> {
  return (await query<IssueRow>(
    `INSERT INTO issues (title, body, severity, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, body, severity, userId],
  ))[0];
}

export async function updateIssue(
  id: string,
  fields: { title?: string; body?: string; severity?: number; status?: string; type?: string },
): Promise<IssueRow | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (fields.title !== undefined) {
    sets.push(`title = $${idx++}`);
    args.push(fields.title);
  }
  if (fields.body !== undefined) {
    sets.push(`body = $${idx++}`);
    args.push(fields.body);
  }
  if (fields.severity !== undefined) {
    sets.push(`severity = $${idx++}`);
    args.push(fields.severity);
  }
  if (fields.status !== undefined) {
    sets.push(`status = $${idx++}`);
    args.push(fields.status);
  }
  if (fields.type !== undefined) {
    sets.push(`type = $${idx++}`);
    args.push(fields.type);
  }

  if (!sets.length) return getIssue(id);

  sets.push(`updated_at = now()`);
  args.push(id);

  const rows = await query<IssueRow>(
    `UPDATE issues SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    args,
  );
  return rows[0] ?? null;
}
