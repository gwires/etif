# TODO

<!-- Checkbox conventions: [x] done · [ ] pending · [~] intentionally deferred (see AGENTS.md) -->

## Milestone 1: Flake + Dev Shell ([spec](milestones/MILESTONE-001.md))

- [x] Create `flake.nix` with dev shell
- [x] Generate `flake.lock`
- [x] Verify all tools available

## Milestone 2: DB Migrations v2 ([spec](milestones/MILESTONE-002.md))

- [x] Delete old migration files from `db/migrations/`
- [x] Write `001_create_users.sql` (with display_name, about, avatar_path)
- [x] Write `002_create_sessions.sql`
- [x] Write `003_create_captcha_challenges.sql`
- [x] Write `004_create_captures.sql` (captures, capture_urls, capture_images, capture_regions)
- [x] Verify: `dbmate up` on empty DB, all 7 tables created

## Milestone 3: Auth + Profile API ([spec](milestones/MILESTONE-003.md))

- [x] Adapt existing auth modules for new schema
- [x] Extend GET /api/auth/me with profile fields
- [x] Add PATCH /api/auth/profile endpoint
- [x] Add POST/DELETE /api/auth/avatar endpoints
- [x] Add GET /avatars/:filename static route
- [x] Wire routes into main.ts
- [x] Remove obsolete approach01 tests (issues/regions/relations/votes/graph)
- [x] Tests pass

## Milestone 4: Captures API ([spec](milestones/MILESTONE-004.md))

- [x] Captures CRUD endpoints (list, create, get, update, delete)
- [x] URL extraction from markdown fields (`extract_urls.ts`)
- [x] Image upload (multiple, with captions, validation)
- [x] GET /api/urls aggregated view
- [x] Wire routes into main.ts
- [x] Tests pass

## Milestone 5: Capture Frontend ([spec](milestones/MILESTONE-005.md))

- [ ] Auth pages (reuse/adapt from approach01)
- [ ] Quick-capture smart field (URL→title, image→attach, text→title)
- [ ] Capture form (title, status selector, what_text, where_text, why_text, when_text, notes, images)
- [ ] Recent captures feed (with status filter)
- [ ] Edit page (pre-populated form, image management)
- [ ] URLs view (table of all user's URLs)
- [ ] Profile page (display_name, about, avatar)
- [ ] Layout & navigation
- [ ] Verify end-to-end flow
