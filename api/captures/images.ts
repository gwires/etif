// Image upload and deletion for captures.
// Multipart parsing is manual (no std multipart in Deno 2.x).
// Validates magic bytes, max size, and MIME type.

import { STATUS_CODE } from "../deps.ts";
import { query, queryOne, execute } from "../db.ts";
import { requireAuth, type AuthContext } from "../auth/middleware.ts";
import { config } from "../config.ts";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// Magic byte signatures
const MAGIC: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP (bytes 0-3 + 8-11)
};

function checkMagic(data: Uint8Array, mime: string): boolean {
  const sig = MAGIC[mime];
  if (!sig) return false;
  if (mime === "image/webp") {
    if (data.length < 12) return false;
    const riff = [0x52, 0x49, 0x46, 0x46];
    const webp = [0x57, 0x45, 0x42, 0x50];
    return riff.every((b, i) => data[i] === b) && webp.every((b, i) => data[i + 8] === b);
  }
  return sig.every((b, i) => data[i] === b);
}

/** POST /api/captures/:id/images — upload an image */
export const handleUploadImage = requireAuth(async (req: Request, ctx: AuthContext) => {
  const captureId = extractCaptureId(req.url);
  if (!captureId) return errorResponse("Not found", STATUS_CODE.NotFound);

  // Verify ownership
  const capture = await queryOne<{ id: string }>(
    "SELECT id FROM captures WHERE id = $1 AND user_id = $2",
    [captureId, ctx.userId],
  );
  if (!capture) return errorResponse("Not found", STATUS_CODE.NotFound);

  const contentType = req.headers.get("content-type") ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  if (!boundaryMatch) return errorResponse("Missing boundary", STATUS_CODE.BadRequest);
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];

  const body = new Uint8Array(await req.arrayBuffer());
  const parts = parseMultipart(body, boundary);

  // Find the file part
  const filePart = parts.find((p) => p.filename);
  if (!filePart) return errorResponse("No file uploaded", STATUS_CODE.BadRequest);

  const mime = filePart.contentType ?? "";
  if (!(mime in ALLOWED_TYPES)) {
    return errorResponse(`Unsupported type: ${mime}. Allowed: jpeg, png, gif, webp`, STATUS_CODE.BadRequest);
  }

  if (filePart.data.length > MAX_IMAGE_SIZE) {
    return errorResponse(`File too large (${filePart.data.length} bytes). Max: 2MB`, STATUS_CODE.ContentTooLarge);
  }

  if (!checkMagic(filePart.data, mime)) {
    return errorResponse("File content does not match declared type", STATUS_CODE.BadRequest);
  }

  // Get caption from form field if present
  const captionPart = parts.find((p) => p.name === "caption");
  const caption = captionPart ? new TextDecoder().decode(captionPart.data) : null;

  // Generate filename
  const ext = ALLOWED_TYPES[mime];
  const timestamp = Date.now();
  // Get next sort order
  const maxOrder = await queryOne<{ max: number | null }>(
    "SELECT MAX(sort_order) AS max FROM capture_images WHERE capture_id = $1",
    [captureId],
  );
  const seq = (maxOrder?.max ?? -1) + 1;
  const filename = `${captureId}-${timestamp}-${seq}${ext}`;

  const imageDir = config.imageDir;
  await Deno.mkdir(imageDir, { recursive: true });
  const filepath = `${imageDir}/${filename}`;
  await Deno.writeFile(filepath, filePart.data);

  const image = await queryOne<{
    id: string;
    capture_id: string;
    path: string;
    caption: string | null;
    sort_order: number;
    created_at: Date;
  }>(
    `INSERT INTO capture_images (capture_id, path, caption, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [captureId, filepath, caption, seq],
  );

  return jsonResponse({
    image: {
      id: image!.id,
      path: image!.path,
      caption: image!.caption,
      sort_order: image!.sort_order,
      created_at: image!.created_at,
    },
  }, STATUS_CODE.Created);
});

/** DELETE /api/captures/:id/images/:img_id — delete a single image */
export const handleDeleteImage = requireAuth(async (req: Request, ctx: AuthContext) => {
  const m = req.url.match(/\/api\/captures\/([0-9a-f-]+)\/images\/([0-9a-f-]+)$/);
  if (!m) return errorResponse("Not found", STATUS_CODE.NotFound);
  const [, captureId, imgId] = m;

  // Verify capture ownership
  const capture = await queryOne<{ id: string }>(
    "SELECT id FROM captures WHERE id = $1 AND user_id = $2",
    [captureId, ctx.userId],
  );
  if (!capture) return errorResponse("Not found", STATUS_CODE.NotFound);

  const image = await queryOne<{ id: string; path: string }>(
    "SELECT id, path FROM capture_images WHERE id = $1 AND capture_id = $2",
    [imgId, captureId],
  );
  if (!image) return errorResponse("Image not found", STATUS_CODE.NotFound);

  try {
    await Deno.remove(image.path);
  } catch { /* already gone */ }

  await execute("DELETE FROM capture_images WHERE id = $1", [imgId]);

  return new Response(null, { status: STATUS_CODE.NoContent });
});

/** GET /images/:filename — serve image files (no auth required) */
export async function handleServeImage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filename = decodeURIComponent(url.pathname.replace(/^\/images\//, ""));

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return new Response("Forbidden", { status: STATUS_CODE.Forbidden });
  }

  const filepath = `${config.imageDir}/${filename}`;
  try {
    const stat = await Deno.stat(filepath);
    if (!stat.isFile) return new Response("Not found", { status: STATUS_CODE.NotFound });
  } catch {
    return new Response("Not found", { status: STATUS_CODE.NotFound });
  }

  const ext = filename.substring(filename.lastIndexOf("."));
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  };

  const file = await Deno.readFile(filepath);
  return new Response(file, {
    headers: {
      "Content-Type": mimeMap[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

// --- multipart parser ---

interface MultipartPart {
  name?: string;
  filename?: string;
  contentType?: string;
  data: Uint8Array;
}

function parseMultipart(body: Uint8Array, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const encoder = new TextEncoder();
  const delimiter = encoder.encode(`--${boundary}`);
  const endDelimiter = encoder.encode(`--${boundary}--`);

  let pos = indexOf(body, delimiter, 0);
  if (pos === -1) return parts;

  pos += delimiter.length;

  while (pos < body.length) {
    // Skip CRLF after delimiter
    if (body[pos] === 0x0D && body[pos + 1] === 0x0A) pos += 2;

    // Check for end delimiter
    if (startsWith(body, endDelimiter, pos - delimiter.length - 2)) break;

    // Parse headers until blank line
    const headerEnd = indexOfCRLFCRLF(body, pos);
    if (headerEnd === -1) break;

    const headerBytes = body.slice(pos, headerEnd);
    const headerText = new TextDecoder().decode(headerBytes);
    pos = headerEnd + 4; // skip \r\n\r\n

    const part: MultipartPart = { data: new Uint8Array() };
    for (const line of headerText.split("\r\n")) {
      const lower = line.toLowerCase();
      if (lower.startsWith("content-disposition:")) {
        const nameMatch = line.match(/name="([^"]*)"/);
        if (nameMatch) part.name = nameMatch[1];
        const fnMatch = line.match(/filename="([^"]*)"/);
        if (fnMatch) part.filename = fnMatch[1];
      } else if (lower.startsWith("content-type:")) {
        part.contentType = line.substring(line.indexOf(":") + 1).trim().split(";")[0].trim();
      }
    }

    // Find next delimiter
    const nextDelim = indexOf(body, delimiter, pos);
    if (nextDelim === -1) break;

    // Data is everything up to the CRLF before the delimiter
    let dataEnd = nextDelim;
    if (body[dataEnd - 2] === 0x0D && body[dataEnd - 1] === 0x0A) dataEnd -= 2;

    part.data = body.slice(pos, dataEnd);
    parts.push(part);

    pos = nextDelim + delimiter.length;
  }

  return parts;
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, start: number): number {
  outer: for (let i = start; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function startsWith(haystack: Uint8Array, needle: Uint8Array, offset: number): boolean {
  if (offset < 0 || offset + needle.length > haystack.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[offset + i] !== needle[i]) return false;
  }
  return true;
}

function indexOfCRLFCRLF(data: Uint8Array, start: number): number {
  for (let i = start; i < data.length - 3; i++) {
    if (data[i] === 0x0D && data[i + 1] === 0x0A && data[i + 2] === 0x0D && data[i + 3] === 0x0A) {
      return i;
    }
  }
  return -1;
}

function extractCaptureId(pathname: string): string | null {
  const m = pathname.match(/\/api\/captures\/([0-9a-f-]+)\/images$/);
  return m ? m[1] : null;
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
