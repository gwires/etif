# Milestone 4: Captures API

## Goal
CRUD for captures, URL extraction on save, multiple image upload, aggregated URLs view.

## Prerequisites
- Milestone 3 complete (auth + profile working)

## Deliverables

### 1. Captures CRUD (`/api/captures/`)

**GET /api/captures** — list captures for authenticated user
- Query params: `status` (filter), `sort` (created_at, updated_at), `order` (asc/desc), `limit`, `offset`
- Return array of captures with all fields
- Default sort: created_at DESC

**POST /api/captures** — create capture
- JSON body: `{ title, status?, what?, where_text?, why?, when?, notes? }`
- Title required, status defaults to `***`
- After insert: extract URLs from all markdown fields → populate `capture_urls`
- Return created capture

**GET /api/captures/:id** — single capture
- Include images and regions in response
- 404 if not found or not owned by user

**PATCH /api/captures/:id** — update capture
- JSON body: any subset of `{ title, status, what, where_text, why, when, notes }`
- After update: delete old `capture_urls`, re-extract from all markdown fields
- Update `updated_at`
- Return updated capture

**DELETE /api/captures/:id** — delete capture
- Cascade deletes capture_urls, capture_images, capture_regions
- Delete associated image files from disk
- Return 204

### 2. URL Extraction (`/api/captures/extract_urls.ts`)

Parse markdown text and extract URLs:
- `[text](url)` — standard markdown links
- Bare URLs: `https://...` or `http://...`
- `<url>` — autolinks

Deduplicate. Return array of URL strings.

Called on create/update across all markdown fields (what, where_text, why, when, notes).
Delete+re-insert pattern for `capture_urls`.

### 3. Image Upload (`/api/captures/images.ts`)

**POST /api/captures/:id/images** — upload image
- Auth required, multipart/form-data
- Validate: max 2MB, jpeg/png/gif/webp
- Magic bytes validation
- Generate filename: `{capture_id}-{timestamp}-{seq}.{ext}`
- Store in `/data/images/`
- Insert into `capture_images` with next sort_order
- Optional `caption` field in form data
- Return created image record

**DELETE /api/captures/:id/images/:img_id** — delete single image
- Delete file from disk
- Delete row from `capture_images`
- Return 204

**Image serving:** reuse static file route pattern.
**GET /images/:filename** — serve from `/data/images/`, no auth required.

### 4. Aggregated URLs View

**GET /api/urls** — all URLs across user's captures
- Join `capture_urls` with `captures`
- Return: `{ url, capture_title, capture_status, capture_id, created_at }`
- Ordered by created_at DESC
- Pagination: limit/offset

### 5. Router wiring
Wire all capture routes into `main.ts`.

## Tests
- `tests/captures_test.ts` — CRUD operations, auth required
- `tests/captures_extract_urls_test.ts` — URL extraction from markdown
- `tests/captures_extract_urls_prop_test.ts` — PBT: extracted URLs are subset of source text
- `tests/captures_images_test.ts` — upload, validation, delete cleanup

## Constraints
- Sequential file processing (memory constraint)
- URL extraction is synchronous and fast (regex only, no fetching)
- No URL classification or metadata fetching
- Images stored as-is, no resizing
- All endpoints require auth
