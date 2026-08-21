// DB queries for issue relations CRUD.

import { query, queryOne, execute } from "../db.ts";

export interface RelationRow {
  [key: string]: unknown;
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  body: string | null;
}

interface RelationWithIssue extends RelationRow {
  other_id: string;
  other_title: string;
  other_type: string;
  other_image_path: string | null;
}

const VALID_RELATION_TYPES = ["causes", "parent_of", "related_to"];

export function isValidRelationType(t: string): boolean {
  return VALID_RELATION_TYPES.includes(t);
}

export async function getRelationsForIssue(issueId: string): Promise<{
  incoming: RelationWithIssue[];
  outgoing: RelationWithIssue[];
}> {
  const outgoing = await query<RelationWithIssue>(
    `SELECT r.*, i.id AS other_id, i.title AS other_title, i.type AS other_type, i.image_path AS other_image_path
     FROM issue_relations r
     JOIN issues i ON i.id = r.target_id
     WHERE r.source_id = $1`,
    [issueId],
  );

  const incoming = await query<RelationWithIssue>(
    `SELECT r.*, i.id AS other_id, i.title AS other_title, i.type AS other_type, i.image_path AS other_image_path
     FROM issue_relations r
     JOIN issues i ON i.id = r.source_id
     WHERE r.target_id = $1`,
    [issueId],
  );

  return { incoming, outgoing };
}

export async function createRelation(
  sourceId: string,
  targetId: string,
  relationType: string,
  body: string | null,
): Promise<RelationRow> {
  return (await query<RelationRow>(
    `INSERT INTO issue_relations (source_id, target_id, relation_type, body)
     VALUES ($1, $2, $3::relation_type, $4) RETURNING *`,
    [sourceId, targetId, relationType, body],
  ))[0];
}

export async function getRelation(id: string): Promise<RelationRow | null> {
  return queryOne<RelationRow>("SELECT * FROM issue_relations WHERE id = $1", [id]);
}

export async function updateRelationBody(
  id: string,
  body: string | null,
): Promise<RelationRow | null> {
  return queryOne<RelationRow>(
    "UPDATE issue_relations SET body = $1 WHERE id = $2 RETURNING *",
    [body, id],
  );
}

export async function deleteRelation(id: string): Promise<number> {
  return execute("DELETE FROM issue_relations WHERE id = $1", [id]);
}

export async function issueExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>("SELECT id FROM issues WHERE id = $1", [id]);
  return row !== null;
}
