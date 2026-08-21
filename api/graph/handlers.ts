// HTTP handler for GET /api/graph?root=<id>&depth=N&direction=outgoing|incoming|both

import { STATUS_CODE } from "../deps.ts";
import { traverseGraph } from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_DIRECTIONS = ["outgoing", "incoming", "both"];
const MAX_DEPTH = 10;
const DEFAULT_DEPTH = 3;

/** GET /api/graph — recursive graph traversal (no auth required) */
export async function handleGraph(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const root = url.searchParams.get("root");
  if (!root) return json({ error: "root parameter is required" }, STATUS_CODE.BadRequest);

  const depthParam = url.searchParams.get("depth");
  let depth = DEFAULT_DEPTH;
  if (depthParam !== null) {
    depth = parseInt(depthParam, 10);
    if (isNaN(depth) || depth < 1) {
      return json({ error: "depth must be a positive integer" }, STATUS_CODE.BadRequest);
    }
    if (depth > MAX_DEPTH) depth = MAX_DEPTH;
  }

  const direction = url.searchParams.get("direction") ?? "outgoing";
  if (!VALID_DIRECTIONS.includes(direction)) {
    return json({ error: "direction must be outgoing, incoming, or both" }, STATUS_CODE.BadRequest);
  }

  const result = await traverseGraph(root, depth, direction as "outgoing" | "incoming" | "both");
  return json(result);
}
