# Milestone 8: Image Upload

## Goal
Allow attaching an image to an issue to form a visual "card". One image per issue.

## Prerequisites
- Milestone 4 complete (issues CRUD working)
- `image_path` column exists on issues table

## Deliverables

### 1. Image Storage (`/api/images/`)

**POST /api/issues/:id/image** (auth required, multipart/form-data)
- Accept single file upload
- Validate: max 2MB, allowed types: jpeg, png, gif, webp
- Generate filename: `{issue_id}-{timestamp}.{ext}`
- Store in `/data/images/` directory (configurable via `IMAGE_DIR` env var)
- Update issue's `image_path` column with relative path
- Return `{ image_path: "..." }`

**DELETE /api/issues/:id/image** (auth required)
- Delete file from disk
- Set `image_path = NULL` on issue
- Returns 204

### 2. Image Serving

**GET /images/:filename**
- Serve static files from `IMAGE_DIR`
- Set appropriate Content-Type based on extension
- Cache-Control: public, max-age=86400 (images are immutable once uploaded — new upload = new filename)
- No auth required

Wire this into the HTTP server as a static file route.

### 3. Image Validation (`/api/images/validate.ts`)
- Check file size before reading entire file into memory (stream-check first bytes for magic number)
- Magic bytes validation:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47`
  - GIF: `47 49 46 38`
  - WebP: `52 49 46 46 ... 57 45 42 50`
- Reject if magic bytes don't match claimed content type
- Do NOT use ImageMagick or heavy image processing libraries

### 4. Integration with Issues API

Update **GET /api/issues/:id** to include full image URL/path in response.

Update **PATCH /api/issues/:id**: if updating other fields, don't touch image_path unless explicitly clearing it.

## Verification
```bash
# Upload image
curl -X POST localhost:8000/api/issues/<id>/image \
  -b 'session=...' \
  -F 'file=@photo.jpg'

# Verify image_path set on issue
curl localhost:8000/api/issues/<id> | jq '.image_path'

# Access image directly
curl -o test.jpg localhost:8000/images/<filename>

# Delete image
curl -X DELETE localhost:8000/api/issues/<id>/image \
  -b 'session=...'
```

## Constraints
- Max file size: 2MB. Enforce at HTTP level (reject large requests before reading body).
- No image resizing/transformation. Store as-is. Frontend handles display sizing via CSS.
- One image per issue. New upload replaces old (delete old file, update path).
- Filesystem storage only. No S3/cloud storage.
- Memory-conscious: stream file writes, don't buffer entire upload in memory. Use Deno's streaming body reader.
- Sanitize filenames: only allow `[a-z0-9.-]`. No path traversal.
