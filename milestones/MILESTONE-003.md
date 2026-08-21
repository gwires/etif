# Milestone 3: Auth + Profile API

## Goal
Reuse existing auth modules from approach01. Add profile and avatar endpoints.

## Prerequisites
- Milestone 2 complete (new migrations applied)

## Deliverables

### 1. Reuse existing auth
Copy/adapt from approach01 code (already working):
- `/api/config.ts` — env vars, DB config
- `/api/deps.ts` — shared dependencies
- `/api/db.ts` — connection pool
- `/api/auth/captcha.ts` — captcha generation/validation
- `/api/auth/session.ts` — session create/validate/destroy
- `/api/auth/middleware.ts` — `requireAuth` middleware
- `/api/auth/signup.ts` — local signup with captcha
- `/api/auth/login.ts` — login + logout + GET /me

Update imports and table references as needed for new schema.

### 2. Extend GET /api/auth/me
Add to response: `display_name`, `about`, `avatar_path`.
These are nullable; return null if not set.

### 3. PATCH /api/auth/profile
Auth required. Accept JSON body:
```json
{ "display_name": "...", "about": "..." }
```
Both fields optional. Update current user's row. Return updated user.

### 4. POST /api/auth/avatar
Auth required. Multipart/form-data, single file.
- Validate: max 500KB, jpeg/png/webp only
- Magic bytes validation (same approach as M8 in approach01)
- Generate filename: `{user_id}-{timestamp}.{ext}`
- Store in `/data/avatars/` (configurable via `AVATAR_DIR` env var)
- Update user's `avatar_path`
- Return `{ avatar_path: "..." }`

### 5. DELETE /api/auth/avatar
Auth required. Delete file, set `avatar_path = NULL`. Return 204.

### 6. Avatar serving
**GET /avatars/:filename** — static file route, no auth required.
Cache-Control: public, max-age=86400.

### 7. Router wiring
Wire all routes into `main.ts`.

## Tests
- `tests/auth_test.ts` — reuse existing tests, adapt for new schema
- `tests/profile_test.ts` — profile update, avatar upload/delete, validation

## Constraints
- No OIDC (deferred)
- Avatar images are small (500KB limit), no resizing
- Reuse existing auth code as much as possible, only modify what the schema change requires
