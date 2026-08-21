// DB queries for graph traversal via recursive CTE on issue_relations.

import { query } from "../db.ts";

export interface GraphNode {
  [key: string]: unknown;
  id: string;
  title: string;
  type: string;
  status: string;
  severity: number | null;
  score: number;
  image_path: string | null;
}

export interface GraphEdge {
  [key: string]: unknown;
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  body: string | null;
  depth: number;
}

type Direction = "outgoing" | "incoming" | "both";

export async function traverseGraph(
  rootId: string,
  maxDepth: number,
  direction: Direction,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  // For "both", we run two separate CTEs and union the results,
  // since PG doesn't allow recursive reference in multiple UNION branches.
  if (direction === "both") {
    const [outResult, inResult] = await Promise.all([
      traverseGraph(rootId, maxDepth, "outgoing"),
      traverseGraph(rootId, maxDepth, "incoming"),
    ]);
    // Deduplicate nodes and edges by id.
    const nodeMap = new Map<string, GraphNode>();
    for (const n of outResult.nodes) nodeMap.set(n.id, n);
    for (const n of inResult.nodes) nodeMap.set(n.id, n);
    const edgeMap = new Map<string, GraphEdge>();
    for (const e of outResult.edges) edgeMap.set(e.id, e);
    for (const e of inResult.edges) edgeMap.set(e.id, e);
    return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
  }

  const isOutgoing = direction === "outgoing";
  const cte = `
    WITH RECURSIVE graph_edges(id, source_id, target_id, relation_type, body, depth) AS (
      SELECT r.id, r.source_id, r.target_id, r.relation_type, r.body, 1
      FROM issue_relations r
      WHERE ${isOutgoing ? "r.source_id" : "r.target_id"} = $1 AND 1 <= $2
      UNION ALL
      SELECT r.id, r.source_id, r.target_id, r.relation_type, r.body, g.depth + 1
      FROM issue_relations r
      JOIN graph_edges g ON ${isOutgoing ? "g.target_id = r.source_id" : "g.source_id = r.target_id"}
      WHERE g.depth < $2
    )
    SELECT DISTINCT * FROM graph_edges`;

  const edges = await query<GraphEdge>(cte, [rootId, maxDepth]);

  if (edges.length === 0) {
    return { nodes: [], edges: [] };
  }

  const issueIds = new Set<string>();
  for (const e of edges) {
    issueIds.add(e.source_id);
    issueIds.add(e.target_id);
  }

  const ids = [...issueIds];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const nodes = await query<GraphNode>(
    `SELECT id, title, type, status, severity, score, image_path FROM issues WHERE id IN (${placeholders})`,
    ids,
  );

  return { nodes, edges };
}
