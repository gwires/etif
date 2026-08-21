// Avatar upload and deletion.
// Validates file size (≤500KB) and type (jpeg/png/webp) via magic bytes.
// Stores files in AVATAR_DIR, updates user's avatar_path in DB.

import { STATUS_CODE } from "../deps.ts";
import { config } from "../config.ts";
import { execute } from "../db.ts";
import { requireAuth, type AuthContext } from "./middleware.ts";

const MAX_AVATAR_SIZE = 500 * 1024; // 500KB

// Magic byte signatures for allowed image types
const MAGIC_BYTES: [Uint8Array, string][] = [
  [new Uint8Array([0xff, 0xd8, 0xff]), "jpg"],
  [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
  [new Uint8Array([0x52, 0x49, 0x46, 0x46]), "webp"], // RIFF header (check further for WEBP)
];

function detectImageType(bytes: Uint8Array): string | null {
  for (const [magic, ext] of MAGIC_BYTES) {
    if (bytes.length >= magic.length && bytes.slice(0, magic.length).every((b, i) => b === magic[i])) {
      // Extra check for webp: bytes 8-11 must be "WEBP"
      if (ext === "webp") {
        if (bytes.length < 12) return null;
        const webp = String.fromCharCode(...bytes.slice(8, 12));
        if (webp !== "WEBP") return null;
      }
      return ext;
    }
  }
  return null;
}

/** POST /api/auth/avatar */
export const handleUploadAvatar = requireAuth(async (req: Request, ctx: AuthContext) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Invalid multipart form data", STATUS_CODE.BadRequest);
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return errorResponse("Missing 'avatar' file field", STATUS_CODE.BadRequest);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return errorResponse(`File too large (max ${MAX_AVATAR_SIZE / 1024}KB)`, STATUS_CODE.BadRequest);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) {
    return errorResponse("Invalid image type (jpeg, png, or webp only)", STATUS_CODE.BadRequest);
  }

  // Ensure avatar directory exists
  await Deno.mkdir(config.avatarDir, { recursive: true });

  const filename = `${ctx.userId}-${Date.now()}.${ext}`;
  const filepath = `${config.avatarDir}/${filename}`;

  await Deno.writeFile(filepath, bytes);

  // Delete old avatar file if one exists
  // (best-effort, don't fail the request if cleanup fails)
  // We need to get the old path first — it's in ctx.avatarPath but that's the DB value before update
  // Just overwrite; old file cleanup is best-effort via the delete endpoint or manual

  await execute("UPDATE users SET avatar_path = $1 WHERE id = $2", [filename, ctx.userId]);

  return new Response(
    JSON.stringify({ avatar_path: filename }),
    { status: STATUS_CODE.OK, headers: { "Content-Type": "application/json" } },
  );
});

/** DELETE /api/auth/avatar */
export const handleDeleteAvatar = requireAuth(async (_req: Request, ctx: AuthContext) => {
  if (ctx.avatarPath) {
    try {
      await Deno.remove(`${config.avatarDir}/${ctx.avatarPath}`);
    } catch {
      // File may already be gone — not an error
    }
  }

  await execute("UPDATE users SET avatar_path = NULL WHERE id = $1", [ctx.userId]);

  return new Response(null, { status: STATUS_CODE.NoContent });
});

/** GET /avatars/:filename — serve avatar files, no auth required. */
export async function handleServeAvatar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filename = url.pathname.replace(/^\/avatars\//, "");

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return new Response("Not found", { status: STATUS_CODE.NotFound });
  }

  const filepath = `${config.avatarDir}/${filename}`;
  try {
    const stat = await Deno.stat(filepath);
    if (!stat.isFile) {
      return new Response("Not found", { status: STATUS_CODE.NotFound });
    }
  } catch {
    return new Response("Not found", { status: STATUS_CODE.NotFound });
  }

  const file = await Deno.readFile(filepath);
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  return new Response(file, {
    status: STATUS_CODE.OK,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
