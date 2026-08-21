# AGENTS.md

**NEVER COMMIT OR OTHERWISE MODIFY GIT UNLESS I EXPLICITLY TELL YOU**

## Principles
- Minimal code, minimal CSS, minimal dependencies.
- Platform-native over frameworks. HTML > components. Text > icons.
- Every abstraction must earn its place.
- Server-rendered by default. Client JS only when interactivity demands it.
- Memory-constrained environment: sequential builds, no heavy watchers.

## Stack
- Nix flake for dev shell and reproducible builds.
- PostgreSQL + dbmate for schema management. pg_s2 for S2 geometry.
- Deno (Oak or bare http/std) for backend API.
- Svelte (SvelteKit, pnpm) for frontend — but keep it thin.
- No CSS frameworks. Single stylesheet or inline. No preprocessors.
- No icon libraries. Unicode/text/SVG only.

## Code Style
- Small files. One concern per file.
- Prefer Deno std library over third-party packages.
- Types only where they prevent real bugs, not for ceremony.
- No barrel exports, no index files re-exporting everything.
- Comments explain *why*, not *what*.
- Format all `.nix` files with `nixfmt` before committing.

## Testing
- Write tests with `@std/testing/bdd` (describe/it) and assertions from `@std/assert`. TAP output is produced by the runner (`deno test --reporter=tap`), not by a library import. There is no `@std/testing/tap` — do not use it.
- Tests live in `/tests/`, mirroring source structure: `db_test.ts`, `auth_captcha_test.ts`, `citations_extract_test.ts`, etc.
- Run all tests: `scripts/unit-test.sh` (must be run inside dev shell).
- Every module with non-trivial logic gets a test file. Pure functions get unit tests; DB-touching code gets integration tests against live PostgreSQL.
- Property-based tests use `npm:fast-check@3` for pure logic modules where properties are more valuable than examples (extractors, parsers, algorithms). Not for DB or HTTP tests. PBT files use `_prop_test.ts` suffix.
- Tests must clean up after themselves. Use `_test_` prefix for any DB side effects, delete in finally blocks.
- Keep test output minimal: no console.log of data, no dumping rows. Assert silently, report only pass/fail + failure detail.
- After implementing a task, run `scripts/unit-test.sh` and confirm all green before reporting completion.

### Test Pitfalls
- **DB pool resource leaks:** Deno's resource sanitizers flag connections opened at module import time (e.g., the pool in `api/db.ts`). DB-touching test suites must disable sanitizers on the describe block: `{ sanitizeOps: false, sanitizeResources: false }`. Each test still cleans up its own side effects via finally blocks.
- **jsonb columns:** Cannot use `LIKE` directly on jsonb. Cast first: `column::text LIKE '%pattern%'`. Applies to cleanup queries in `tests/helpers.ts`.
- **Pool lifecycle:** Call `closePool()` from `api/db.ts` and `closeTestClient()` from `tests/helpers.ts` in test teardown to avoid TCP connection leaks.

## Architecture
- Monorepo: `/api` (Deno), `/capture` `/tracker` `/community` `/action` (separate SvelteKit frontends), `/db` (migrations).
- REST JSON API shared by all frontends. Server-rendered pages where possible.
- Auth: OIDC + local accounts with custom captcha. Session cookies.
- Four separate frontends, each with own audience and look/feel:
  - Capture: quick draft entry + refinery (build first)
  - Tracker: GitHub-like issue management
  - Community: Wikipedia talk-page meets HN/SO discussion
  - Direct Action: actionable items for end users
- Issues typed as draft/problem/cause/action with hierarchical decomposition.
- Link extraction from markdown body → citations table (video/article/news/location).
- Location URLs → coordinates → S2 cells → regions.
- Issue versions for community refinement and voting.
- Multi-region via S2 cells. Relations form a directed graph with markdown bodies.
- Everything is public. No private content.

## Workflow
- Always run tool commands via the dev shell: `scripts/run.sh deno check api/main.ts`. Never call `deno`, `pnpm`, `dbmate` etc. outside the shell.
- Plan before code. Get approval before implementing.
- Output diffs, not full file rewrites.
- Never commit without explicit instruction.
- Test migrations on empty DB before proceeding.
- Build incrementally. Verify each layer before adding the next.

### Task Tracking Protocol
1. Before starting a milestone, break it into discrete tasks in `TODO.md`.
2. Present the task list and wait for explicit approval.
3. Implement one task at a time. After completing each task:
   - Check the box in `TODO.md`.
   - Run `scripts/unit-test.sh` and confirm all tests pass.
   - Stop and report completion.
   - Wait for user input before proceeding to the next task.
4. Do not batch tasks. Do not proceed without acknowledgment.
5. If a task needs refinement mid-implementation, update `TODO.md` and confirm with the user.
