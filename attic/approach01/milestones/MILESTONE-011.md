# Milestone 11: Capture Frontend

## Goal
Build the Capture frontend — a SvelteKit app for quick issue drafting and viewing recent captures. Auth required.

## Prerequisites
- Milestones 3-5 complete (auth + issues API + citations working)
- pnpm available in dev shell

## Project Setup

### Scaffold
```bash
cd /home/user/wd/everything-fucked
pnpm create svelte@latest capture --template skeleton-typescript
cd capture
pnpm install
```

Use skeleton template (not skeleton-with-tests). TypeScript for type safety but keep types minimal.

### Config
- SvelteKit config lives in `vite.config.ts` via the `sveltekit()` plugin — do **not** create a separate `svelte.config.js` (it will be ignored with a warning).
- Adapter: `@sveltejs/adapter-node` (configured in `vite.config.ts`).

### Shared Styles (`capture/src/app.css`)
Single small CSS file. Minimal reset, typography, form styles, card layout. No frameworks. Target < 3KB.

## Deliverables

### 1. Auth Pages

**`/signup`** (`src/routes/signup/+page.svelte`)
- Form: username, password, captcha challenge display, captcha answer input
- On mount: fetch captcha from GET /api/auth/captcha
- Display challenge_data as text (arithmetic question, word puzzle, etc.)
- On submit: POST /api/auth/signup → redirect to /capture/recent on success
- Show errors inline

**`/login`** (`src/routes/login/+page.svelte`)
- Form: username, password
- OIDC button: "Sign in with [provider]" → links to /api/auth/oidc/authorize
- On submit: POST /api/auth/login → redirect to /capture/recent

**`/auth/callback`** (`src/routes/auth/callback/+page.server.ts`)
- Server-side handler for OIDC callback
- Forwards code+state to backend API
- Sets session cookie from response
- Redirects to /capture/recent

**`/logout`** (`src/routes/logout/+page.server.ts`)
- POST action: calls DELETE /api/auth/logout
- Clears session cookie
- Redirects to /login

### 2. Auth State Management

**`src/lib/auth.ts`**
- Load user from session cookie via GET /api/auth/me
- Use Svelte 5 `$state()` runes for reactive state; use stores only for cross-component shared state
- Provide `user` and `isAuthenticated` throughout app
- Layout root checks auth, redirects to /login if not authenticated

### 3. Capture Page

**`/capture`** (`src/routes/capture/+page.svelte`)
- Title input (text, required)
- Body textarea (markdown, required, min 10 chars)
- Severity selector (1-5, optional)
- Submit button → POST /api/issues
- On success: redirect to /capture/recent or show success message with link to new issue
- Preview: basic markdown preview toggle (use a simple renderer, no heavy library)
- Helper text explaining link formats supported

### 4. Recent Captures Feed

**`/capture/recent`** (`src/routes/capture/recent/+page.svelte`)
- List of recent drafts (GET /api/issues?type=draft&sort=created_at&order=desc)
- Each entry shows: title, body excerpt (first 150 chars), created_by, created_at, citation count
- Link to /refine/:id for each draft
- Pagination: load more button or infinite scroll (prefer simple pagination)
- Public: visible to all authenticated users

### 5. Issue Edit Page

**`/i/[id]/edit`** (`src/routes/i/[id]/edit/+page.svelte`)
- Same form as /capture but pre-populated with existing issue data
- PATCH /api/issues/:id on submit
- Shows current citations below form (read-only list)
- Image upload section (milestone 8 integration — can stub initially)

### 6. Layout & Navigation

**`src/routes/+layout.svelte`**
- Nav bar: logo/site name, Capture link, Recent link, username, logout button
- Main content area
- Footer minimal
- Mobile-responsive with basic CSS (no framework)

### 7. API Client (`src/lib/api.ts`)
- Thin wrapper around fetch
- Handles base URL, credentials (cookies), JSON parsing
- Methods: get, post, patch, delete
- Error handling: extract error message from API responses

## Verification
```bash
cd capture
pnpm dev
# Visit http://localhost:5173/signup
# Create account, verify redirect to /capture/recent
# Create a draft with links, verify it appears in recent feed
# Check citations were extracted
```

## Constraints
- Server-rendered pages wherever possible (SvelteKit SSR by default).
- Client JS only for interactive elements (form submission, markdown preview toggle).
- Single CSS file, no component library, no icon library.
- No state management libraries. Use `$state()` runes for local reactive state, Svelte stores for shared cross-component state.
- API calls go through local proxy or direct to backend. Configure API_URL env var.
- Memory-conscious: `pnpm dev` uses Vite which is lighter than webpack. Don't run both frontend and backend dev servers simultaneously if memory is tight — build frontend and serve statically.
- Keep total bundle size under 50KB gzipped (excluding images).
