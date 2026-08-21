# TODO

<!-- Checkbox conventions: [x] done · [ ] pending · [~] intentionally deferred (see AGENTS.md) -->

## Milestone 1: Flake + Dev Shell ([spec](milestones/MILESTONE-001.md))

- [x] Create `flake.nix` with inputs (nixpkgs stable) and `devShells.default` using `mkShell`, including: deno, pnpm, nodejs, dbmate, postgresql, libpq. Set env vars (`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`). Add `shellHook` that prints tool versions on entry.
- [x] Run `nix flake lock` to generate `flake.lock`.
- [x] Verify dev shell: enter `nix develop` and confirm all tools are available (`deno --version`, `pnpm --version`, `node --version`, `dbmate --version`, `psql --version`).

## Fast path to working frontend

Priority: get Capture frontend running ASAP. Skip non-essential milestones.

Path: M3 (finish) → M4 → M11

Deferred: 3g (OIDC), M5–M10 (enrichment features). All can be added later without refactoring.

- [x] Milestone 2: DB migrations ([spec](milestones/MILESTONE-002.md))
  - [x] 2a: Create `/db/dbmate.env` configuration file
  - [x] 2b: Create migration `001_create_enums.sql`
  - [x] 2c: Create migration `002_create_users.sql`
  - [x] 2d: Create migration `003_create_sessions.sql`
  - [x] 2e: Create migration `004_create_captcha_challenges.sql`
  - [x] 2f: Create migration `005_create_citations.sql`
  - [x] 2g: Create migration `006_create_issues.sql`
  - [x] 2h: Create migration `007_create_issue_versions.sql`
  - [x] 2i: Create migration `008_create_tags.sql`
  - [x] 2j: Create migration `009_create_issue_tags.sql`
  - [x] 2k: Create migration `010_create_issue_regions.sql`
  - [x] 2l: Create migration `011_create_issue_relations.sql`
  - [x] 2m: Create migration `012_create_issue_citations.sql`
  - [x] 2n: Create migration `013_create_comments.sql`
  - [x] 2o: Create migration `014_create_votes.sql`
  - [x] 2p: Ensure PostgreSQL is running, run `dbmate up`, verify all 14 tables and 5 enums
- [ ] Milestone 3: Auth ([spec](milestones/MILESTONE-003.md))
  - [x] 3a: Project scaffold + config (`/api/config.ts`, `/api/deps.ts`, `/api/main.ts`)
  - [x] 3b: Database connection utility (`/api/db.ts`)
  - [x] 3b-test: DB integration tests (`tests/db_test.ts`, `tests/helpers.ts`, `scripts/unit-test.sh`)
  - [x] 3c: Captcha system (`/api/auth/captcha.ts`)
  - [x] 3d: Session management (`/api/auth/session.ts`, `/api/auth/middleware.ts`)
  - [x] 3e: Local signup (`/api/auth/signup.ts`)
  - [x] 3f: Local login + logout + me (`/api/auth/login.ts`)
  - [~] 3g: OIDC flow (`/api/auth/oidc.ts`) — *deferred, local auth sufficient for now*
  - [x] 3h: Router wiring + verification
- [ ] Milestone 4: Core API ([spec](milestones/MILESTONE-004.md))
  - [x] 4a: Issues CRUD (`/api/issues/`)
  - [x] 4b: Relations CRUD (`/api/relations/`)
  - [x] 4c: Regions (`/api/regions/`)
  - [x] 4c-auth: Wrap existing read endpoints with `requireAuth` (issues list, issues get, relations get)
  - [x] 4d: Comments (`/api/comments/`)
  - [x] 4e: Votes (`/api/votes/`)
  - [x] 4f: Graph traversal (`/api/graph/`)
  - [x] 4g: Router setup — wired all routes (issues, relations, regions, comments, votes, graph) into `main.ts`
- [~] Milestone 5: Link extraction + citations ([spec](milestones/MILESTONE-005.md)) — *deferred, capture works without auto-extraction*
- [~] Milestone 6: Location extraction ([spec](milestones/MILESTONE-006.md)) — *deferred*
- [~] Milestone 7: Tags + ontology ([spec](milestones/MILESTONE-007.md)) — *deferred*
- [~] Milestone 8: Image upload ([spec](milestones/MILESTONE-008.md)) — *deferred*
- [~] Milestone 9: Issue versions ([spec](milestones/MILESTONE-009.md)) — *deferred*
- [~] Milestone 10: Data dumps ([spec](milestones/MILESTONE-010.md)) — *deferred*
- [ ] Milestone 11: Capture frontend ([spec](milestones/MILESTONE-011.md)) — *citation features deferred until M5 lands*
  - [x] 11a: Scaffold + config (SvelteKit skeleton-typescript, adapter-node)
  - [x] 11b: API client (`src/lib/api.ts`)
  - [x] 11c: Auth state management (`src/lib/auth.ts`)
  - [x] 11d: Auth pages (signup, login, logout)
  - [ ] 11e: Layout & navigation (`+layout.svelte`, `app.css`)
  - [x] 11f: Capture page (draft creation form)
  - [ ] 11g: Recent captures feed
  - [ ] 11h: Issue edit page
- [ ] Milestone 12: Refinery + LLM assist ([spec](milestones/MILESTONE-012.md))
- [ ] Milestone 13: Tracker frontend ([spec](milestones/MILESTONE-013.md))
- [ ] Milestone 14: Community frontend ([spec](milestones/MILESTONE-014.md))
- [ ] Milestone 15: Direct Action frontend ([spec](milestones/MILESTONE-015.md))
- [ ] Milestone 16: Seed ontology import ([spec](milestones/MILESTONE-016.md))
