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

## Deliverables

### 1. Auth Pages
Reuse from approach01, adapt for new schema:
- `/signup` — signup form + captcha
- `/login` — login form
- `/logout` — destroy session
- Auth state management (`src/lib/auth.ts`)

### 2. Quick-Capture Smart Field

Single input at top of capture form. Behavior:

| Input | Detection | Action |
|-------|-----------|--------|
| URL pasted | Regex `https?://...` | Fetch title via backend or `<title>` parse → fill title field, set status=`***`, append URL to notes |
| Image pasted/dropped | File/blob on paste/drop event | Trigger image upload flow, set status=`***`, focus title field |
| Plain text typed + Enter | Fallback | Fill title with text, set status=`***` |

Frontend-only orchestration. The URL→title fetch can use a simple backend endpoint or be done client-side with a CORS-friendly approach.

### 3. Capture Form (`/capture`)

Fields:
- **Quick-capture input** (smart field described above)
- **Title** (text, required) — pre-filled by quick-capture
- **Status** (selector: `***` / `**` / `*` / done) — defaults to `***`
- **What** (textarea, markdown)
- **Where** (textarea, markdown)
- **Why** (textarea, markdown)
- **When** (textarea, markdown)
- **Notes** (textarea, markdown)
- **Images** (upload area, multiple files, drag+drop or click)
- Submit button → POST /api/captures

On success: redirect to `/capture/recent`.

### 4. Recent Captures Feed (`/capture/recent`)

- List of user's captures, sorted by created_at DESC
- Each entry: star-prefixed title (based on status), what excerpt (first 150 chars), created_at, image count, URL count
- Link to `/i/:id/edit`
- Filter by status (tabs or dropdown)
- Pagination

### 5. Edit Page (`/i/[id]/edit`)

Same form as capture but pre-populated with existing data.
PATCH /api/captures/:id on submit.
Image management: show existing images with delete buttons, add new ones.

### 6. URLs View (`/urls`)

Table of all URLs across user's captures:
- Columns: URL, capture title (with stars), date
- Sorted by date DESC
- Clickable URLs (open in new tab)
- Clickable capture titles (go to edit page)

### 7. Profile Page (`/profile`)

- Display name input
- About textarea (markdown)
- Avatar upload (single image, preview, delete button)
- Save button → PATCH /api/auth/profile (+ avatar upload separate)

### 8. Layout & Navigation

`src/routes/+layout.svelte`:
- Nav: site name, Capture link, Recent link, URLs link, profile avatar+name, logout
- Main content area
- Mobile-responsive basic CSS

### 9. API Client (`src/lib/api.ts`)
Thin wrapper around fetch. Handles base URL, credentials, JSON parsing.
Methods: get, post, patch, delete, upload (multipart).

## Verification
```bash
cd capture && pnpm dev
# Visit http://localhost:5173/signup
# Create account, create capture via quick-capture URL paste
# Verify it appears in recent feed
# Check /urls shows extracted URL
# Edit profile, upload avatar
```

## Constraints
- Server-rendered pages wherever possible
- Client JS only for interactive elements (quick-capture field, image upload, form submission)
- Single CSS file, no component library, no icon library
- Svelte 5 `$state()` runes for reactive state
- Memory-conscious: don't run frontend and backend dev servers simultaneously
- Keep total bundle size under 50KB gzipped
