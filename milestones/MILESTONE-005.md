# Milestone 5: Capture Frontend

## Goal
Build the Capture frontend with quick-capture smart field, capture form, recent feed, URLs view, profile page, and edit page.

## Prerequisites
- Milestone 4 complete (captures API working)
- pnpm available in dev shell

## Project Setup

Reuse existing SvelteKit scaffold from approach01 (`capture/` directory).
Update config as needed for new routes and API endpoints.

### Config
- SvelteKit config in `vite.config.ts` via `sveltekit()` plugin
- Adapter: `@sveltejs/adapter-node`
- Svelte 5 runes mode enabled

### Shared Styles (`capture/src/app.css`)
Single small CSS file. Minimal reset, typography, form styles, card layout. No frameworks.

## Session Tasks

Each task is one session. Complete one at a time, run tests/checks, then stop.

### Task 1: API Client + Types
**Files:** `capture/src/lib/api.ts`, `capture/src/lib/auth.ts`

- Replace old Issue/Relation/Comment types with new types: `Capture`, `CaptureImage`, `CaptureUrl`, `ProfileUser`
- Update `User` type to include `display_name`, `about`, `avatar_path`
- Add `upload(path, formData)` method to ApiClient for multipart image upload
- Update `auth.ts` to use new User shape
- Auth pages (`login`, `signup`, `logout`) already work — verify they still compile with updated types

### Task 2: Layout + Navigation + CSS Foundation
**Files:** `capture/src/routes/+layout.svelte`, `capture/src/app.css`

- Update nav links: New, Recent, URLs, Profile (with display_name/avatar), Logout
- Mobile-responsive hamburger menu (already partially done)
- Add CSS to `app.css`: status badges (star colors), form grid, image thumbnails, filter tabs, URL table, profile avatar, smart field styling
- Root `+page.svelte` redirect stays as-is

### Task 3: Capture Form + Quick-Capture Smart Field
**File:** `capture/src/routes/capture/+page.svelte`

- Rewrite from issue-based to capture schema
- Quick-capture smart field at top:
  - URL paste → fill title with URL, set status=`***`
  - Image paste/drop → store files for upload after create, focus title
  - Plain text + Enter → fill title, set status=`***`
- Fields: title (text), status (select: `***`/`**`/`*`/done), what_text, where_text, why_text, when_text, notes (all textarea)
- Image upload area (drag+drop, multiple files, preview thumbnails)
- Submit: POST /api/captures → get back capture ID → upload images → redirect to /capture/recent
- No markdown preview (keep it simple)

### Task 4: Recent Captures Feed
**File:** `capture/src/routes/capture/recent/+page.svelte`

- Rewrite to use captures API instead of issues API
- List captures sorted by created_at DESC
- Each entry: status stars + title, what_text excerpt (150 chars), date, image count, URL count
- Status filter tabs (all / `***` / `**` / `*` / done)
- Pagination (limit/offset)
- Link to `/i/:id/edit`

### Task 5: Edit Page
**File:** `capture/src/routes/i/[id]/edit/+page.svelte`

- Rewrite to use captures API
- Pre-populated form (same fields as capture form, no quick-capture field)
- Existing images displayed as thumbnails with delete buttons
- Add new images section
- Submit: PATCH /api/captures/:id
- Image delete: DELETE /api/captures/:id/images/:img_id
- Image add: POST /api/captures/:id/images

### Task 6: URLs View
**File:** `capture/src/routes/urls/+page.svelte` (new)

- GET /api/urls on mount
- Table: URL (clickable, new tab), capture title with stars (links to edit), date
- Sorted by date DESC
- Pagination

### Task 7: Profile Page
**File:** `capture/src/routes/profile/+page.svelte` (new)

- Load current profile from /api/auth/me on mount
- Display name input, about textarea
- Avatar: preview current, upload new (POST /api/auth/avatar), delete
- Save button: PATCH /api/auth/profile
- On save success, refresh auth state

### Task 8: Verify + Fix
- Run `scripts/run.sh bash -c 'cd capture && pnpm check'`
- Fix any type errors or warnings
- Confirm all routes render without console errors

## Constraints
- Server-rendered pages wherever possible
- Client JS only for interactive elements (quick-capture field, image upload, form submission)
- Single CSS file, no component library, no icon library
- Svelte 5 `$state()` runes for reactive state
- Memory-conscious: don't run frontend and backend dev servers simultaneously
- Keep total bundle size under 50KB gzipped
