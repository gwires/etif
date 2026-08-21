// Captures CRUD handlers.
// All endpoints require authentication and operate on the authenticated user's captures.

import { STATUS_CODE } from "../deps.ts";
import { query, queryOne, execute, withTransaction } from "../db.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import { extractUrls } from "./extract_urls.ts";
import { config } from "../config.ts";

const MARKDOWN_FIELDS = ["what_text", "where_text", "why_text", "when_text", "notes"] as const;

interface CaptureRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  title: string;
  status: string;
  what_text: string | null;
  where_text: string | null;
  why_text: string | null;
  when_text: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ImageRow extends Record<string, unknown> {
  id: string;
  capture_id: string;
  path: string;
  caption: string | null;
  sort_order: number;
  created_at: Date;
}

function formatCapture(row: CaptureRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    what_text: row.what_text,
    where_text: row.where_text,
    why_text: row.why_text,
    when_text: row.when_text,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function saveUrls(captureId: string, urls: string[]): Promise<void> {
  for (const url of urls) {
    await execute(
      "INSERT INTO capture_urls (capture_id, url) VALUES ($1, $2)",
      [captureId, url],
    );
  }
}

async function replaceUrls(captureId: string, ...texts: (string | null | undefined)[]): Promise<void> {
  await execute("DELETE FROM capture_urls WHERE capture_id = $1", [captureId]);
  const urls = extractUrls(...texts);
  await saveUrls(captureId, urls);
}

/** GET /api/captures — list captures with optional filters */
export const handleListCaptures = requireAuth(async (req: Request, ctx: AuthContext) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") ?? "created_at";
  const order = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const validSorts = ["created_at", "updated_at"];
  const sortCol = validSorts.includes(sort) ? sort : "created_at";

  let sql = "SELECT * FROM captures WHERE user_id = $1";
  const args: unknown[] = [ctx.userId];
  let argIdx = 2;

  if (status) {
    sql += ` AND status = $${argIdx++}`;
    args.push(status);
  }

  sql += ` ORDER BY ${sortCol} ${order} LIMIT $${argIdx++} OFFSET $${argIdx++}`;
  args.push(limit, offset);

  const rows = await query<CaptureRow>(sql, args);
  return jsonResponse({ captures: rows.map(formatCapture) });
});

/** POST /api/captures — create a capture */
export const handleCreateCapture = requireAuth(async (req: Request, ctx: AuthContext) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", STATUS_CODE.BadRequest);
  }

  const title = body.title as string | undefined;
  if (!title || !title.trim()) {
    return errorResponse("Title is required", STATUS_CODE.BadRequest);
  }

  const status = (body.status as string) ?? "***";
  const whatText = body.what_text as string | null ?? null;
  const whereText = body.where_text as string | null ?? null;
  const whyText = body.why_text as string | null ?? null;
  const whenText = body.when_text as string | null ?? null;
  const notes = body.notes as string | null ?? null;

  const capture = await queryOne<CaptureRow>(
    `INSERT INTO captures (user_id, title, status, what_text, where_text, why_text, when_text, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [ctx.userId, title.trim(), status, whatText, whereText, whyText, whenText, notes],
  );

  if (!capture) {
    return errorResponse("Failed to create capture", STATUS_CODE.InternalServerError);
  }

  await replaceUrls(capture.id, whatText, whereText, whyText, whenText, notes);

  return jsonResponse({ capture: formatCapture(capture) }, STATUS_CODE.Created);
});

/** GET /api/captures/:id — single capture with images */
export const handleGetCapture = requireAuth(async (req: Request, ctx: AuthContext) => {
  const id = extractId(req.url, /\/api\/captures\/([0-9a-f-]+)$/);
  if (!id) return errorResponse("Not found", STATUS_CODE.NotFound);

  const capture = await queryOne<CaptureRow>(
    "SELECT * FROM captures WHERE id = $1 AND user_id = $2",
    [id, ctx.userId],
  );
  if (!capture) return errorResponse("Not found", STATUS_CODE.NotFound);

  const images = await query<ImageRow>(
    "SELECT * FROM capture_images WHERE capture_id = $1 ORDER BY sort_order",
    [id],
  );

  return jsonResponse({
    capture: { ...formatCapture(capture), images: images.map(formatImage) },
  });
});

/** PATCH /api/captures/:id — update a capture */
export const handleUpdateCapture = requireAuth(async (req: Request, ctx: AuthContext) => {
  const id = extractId(req.url, /\/api\/captures\/([0-9a-f-]+)$/);
  if (!id) return errorResponse("Not found", STATUS_CODE.NotFound);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", STATUS_CODE.BadRequest);
  }

  // Verify ownership
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM captures WHERE id = $1 AND user_id = $2",
    [id, ctx.userId],
  );
  if (!existing) return errorResponse("Not found", STATUS_CODE.NotFound);

  const updates: string[] = [];
  const args: unknown[] = [];
  let argIdx = 1;

  const allowedFields = ["title", "status", "what_text", "where_text", "why_text", "when_text", "notes"];
  for (const field of allowedFields) {
    if (field in body) {
      const col = field;
      const val = body[field] === undefined ? null : body[field];
      updates.push(`${col} = $${argIdx++}`);
      args.push(typeof val === "string" && field === "title" ? val.trim() : val);
    }
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", STATUS_CODE.BadRequest);
  }

  updates.push(`updated_at = now()`);
  args.push(id);

  const capture = await queryOne<CaptureRow>(
    `UPDATE captures SET ${updates.join(", ")} WHERE id = $${argIdx} RETURNING *`,
    args,
  );

  if (!capture) {
    return errorResponse("Update failed", STATUS_CODE.InternalServerError);
  }

  // Re-extract URLs from all markdown fields (use updated values)
  await replaceUrls(
    capture.id,
    capture.what_text,
    capture.where_text,
    capture.why_text,
    capture.when_text,
    capture.notes,
  );

  return jsonResponse({ capture: formatCapture(capture) });
});

/** DELETE /api/captures/:id — delete a capture and its associated data */
export const handleDeleteCapture = requireAuth(async (req: Request, ctx: AuthContext) => {
  const id = extractId(req.url, /\/api\/captures\/([0-9a-f-]+)$/);
  if (!id) return errorResponse("Not found", STATUS_CODE.NotFound);

  // Get image paths before deletion so we can clean up files
  const images = await query<{ path: string }>(
    "SELECT path FROM capture_images WHERE capture_id IN (SELECT id FROM captures WHERE id = $1 AND user_id = $2)",
    [id, ctx.userId],
  );

  const deleted = await execute(
    "DELETE FROM captures WHERE id = $1 AND user_id = $2",
    [id, ctx.userId],
  );

  if (deleted === 0) return errorResponse("Not found", STATUS_CODE.NotFound);

  // Clean up image files
  for (const img of images) {
    try {
      await Deno.remove(img.path);
    } catch { /* file may already be gone */ }
  }

  return new Response(null, { status: STATUS_CODE.NoContent });
});

/** GET /api/urls — aggregated URLs across user's captures */
export const handleListUrls = requireAuth(async (req: Request, ctx: AuthContext) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const rows = await query<{
    url: string;
    capture_title: string;
    capture_status: string;
    capture_id: string;
    created_at: Date;
  }>(
    `SELECT cu.url, c.title AS capture_title, c.status AS capture_status,
            c.id AS capture_id, cu.created_at
     FROM capture_urls cu
     JOIN captures c ON c.id = cu.capture_id
     WHERE c.user_id = $1
     ORDER BY cu.created_at DESC
     LIMIT $2 OFFSET $3`,
    [ctx.userId, limit, offset],
  );

  return jsonResponse({ urls: rows });
});

// --- helpers ---

function extractId(pathname: string, pattern: RegExp): string | null {
  const m = pathname.match(pattern);
  return m ? m[1] : null;
}

function formatImage(row: ImageRow) {
  return {
    id: row.id,
    path: row.path,
    caption: row.caption,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

function jsonResponse(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
