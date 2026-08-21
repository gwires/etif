// HTTP handlers for /api/issues/:id/regions and /api/regions endpoints.

import { STATUS_CODE } from "../deps.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import {
  getRegionsForIssue,
  createRegion,
  getRegion,
  deleteRegion,
  findIssuesByS2Cell,
  issueExists,
} from "./queries.ts";

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(
    JSON.stringify(data, (_key, value) => typeof value === "bigint" ? value.toString() : value),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/** GET /api/issues/:id/regions — list regions for an issue (auth required) */
export const handleGetRegions = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/issues/:id/regions → parts[3] is the issue id
  const issueId = parts[3];

  if (!(await issueExists(issueId))) {
    return json({ error: "Not found" }, STATUS_CODE.NotFound);
  }
  const regions = await getRegionsForIssue(issueId);
  return json(regions);
});

/** POST /api/issues/:id/regions — add region to issue (auth required) */
export const handleCreateRegion = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const issueId = parts[3];

  if (!(await issueExists(issueId))) {
    return json({ error: "Issue not found" }, STATUS_CODE.NotFound);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, STATUS_CODE.BadRequest);
  }

  const s2CellId = typeof body.s2_cell_id === "number" ? BigInt(body.s2_cell_id) : null;
  if (s2CellId === null) {
    return json({ error: "s2_cell_id is required" }, STATUS_CODE.BadRequest);
  }

  const regionName = typeof body.region_name === "string" && body.region_name.trim()
    ? body.region_name.trim()
    : null;

  const region = await createRegion(issueId, s2CellId, regionName);
  return json(region, STATUS_CODE.Created);
});

/** DELETE /api/regions/:id — delete a region (auth required) */
export const handleDeleteRegion = requireAuth(async (_req: Request, _ctx: AuthContext) => {
  const url = new URL(_req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 1];

  const existing = await getRegion(id);
  if (!existing) return json({ error: "Not found" }, STATUS_CODE.NotFound);

  await deleteRegion(id);
  return new Response(null, { status: STATUS_CODE.NoContent });
});

/** GET /api/regions?s2_cell_id=... — find issues by S2 cell (auth required) */
export const handleFindIssuesByRegion = requireAuth(async (req: Request, _ctx: AuthContext) => {
  const url = new URL(req.url);
  const s2Param = url.searchParams.get("s2_cell_id");
  if (!s2Param) {
    return json({ error: "s2_cell_id query param is required" }, STATUS_CODE.BadRequest);
  }

  let s2CellId: bigint;
  try {
    s2CellId = BigInt(s2Param);
  } catch {
    return json({ error: "Invalid s2_cell_id" }, STATUS_CODE.BadRequest);
  }

  const issues = await findIssuesByS2Cell(s2CellId);
  return json(issues);
});
