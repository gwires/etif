// DB queries for issue regions CRUD.

import { query, queryOne, execute } from "../db.ts";

export interface RegionRow {
  [key: string]: unknown;
  id: string;
  issue_id: string;
  s2_cell_id: bigint;
  region_name: string | null;
}

interface IssueSummary {
  [key: string]: unknown;
  id: string;
  title: string;
  type: string;
  status: string;
  severity: number | null;
  score: number;
}

export async function getRegionsForIssue(issueId: string): Promise<RegionRow[]> {
  return query<RegionRow>(
    "SELECT * FROM issue_regions WHERE issue_id = $1 ORDER BY region_name NULLS LAST",
    [issueId],
  );
}

export async function createRegion(
  issueId: string,
  s2CellId: bigint,
  regionName: string | null,
): Promise<RegionRow> {
  return (await query<RegionRow>(
    `INSERT INTO issue_regions (issue_id, s2_cell_id, region_name)
     VALUES ($1, $2, $3) RETURNING *`,
    [issueId, s2CellId, regionName],
  ))[0];
}

export async function getRegion(id: string): Promise<RegionRow | null> {
  return queryOne<RegionRow>("SELECT * FROM issue_regions WHERE id = $1", [id]);
}

export async function deleteRegion(id: string): Promise<number> {
  return execute("DELETE FROM issue_regions WHERE id = $1", [id]);
}

export async function findIssuesByS2Cell(s2CellId: bigint): Promise<IssueSummary[]> {
  return query<IssueSummary>(
    `SELECT DISTINCT i.id, i.title, i.type, i.status, i.severity, i.score
     FROM issues i
     JOIN issue_regions ir ON ir.issue_id = i.id
     WHERE ir.s2_cell_id = $1
     ORDER BY i.score DESC`,
    [s2CellId],
  );
}

export async function issueExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>("SELECT id FROM issues WHERE id = $1", [id]);
  return row !== null;
}
