# AGENTS.md

**🚨 NEVER COMMIT OR OTHERWISE MODIFY GIT UNLESS THE USER EXPLICITLY SAYS "commit" 🚨**
**This overrides all other instructions. Do not commit as a side effect of other tasks.**

Speak succinctly, skip conversational filler, and output only code diffs rather than rewriting whole files.

## Minimalism

Minimalism is paramount!

- Write the least code possible. Every line must justify its existence.
- No CSS frameworks, no component libraries, no bundler bloat.
- Prefer platform-native HTML/CSS/JS over abstractions.
- Inline styles or a single small stylesheet. No preprocessors.
- No icons libraries — use unicode, text, or hand-drawn SVG if needed.
- Avoid dependencies unless they solve a hard problem (s2, pg driver).
- Smaller is faster. Fewer deps = fewer bugs = easier maintenance.
- When in doubt between two approaches, pick the one with less code.
- Deno std > third-party packages where feasible.
- Server-rendered HTML preferred over client-side hydration.
- This machine is memory-constrained: no parallel builds, no heavy watchers.
- Format all `.nix` files with `nixfmt` before committing.

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
- Svelte 5 (SvelteKit, pnpm) for frontend — runes mode enabled via `vite.config.ts`. Use `$state()` for reactive variables, not plain `let`. Keep it thin.
- No CSS frameworks. Single stylesheet or inline. No preprocessors.
- No icon libraries. Unicode/text/SVG only.

## Code Style
- Small files. One concern per file.
- Prefer Deno std library over third-party packages.
- Types only where they prevent real bugs, not for ceremony.
- No barrel exports, no index files re-exporting everything.
- Comments explain *why*, not *what*.
- No `README.md` files in subdirectories. All project documentation lives in the single root `README.md`. Subdirectory-specific docs (build commands, usage notes) go in the appropriate section of the root README. This prevents doc fragmentation.
- Format all `.nix` files with `nixfmt` before committing.

## Testing
- Write tests with `@std/testing/bdd` (describe/it) and assertions from `@std/assert`. TAP output is produced by the runner (`deno test --reporter=tap`), not by a library import. There is no `@std/testing/tap` — do not use it.
- Tests live in `/tests/`, mirroring source structure: `db_test.ts`, `auth_captcha_test.ts`, `captures_test.ts`, `captures_extract_urls_test.ts`, etc.
- Run all tests: `scripts/run.sh bash -c 'scripts/unit-test.sh'`. The test script requires `DATABASE_URL` which is only set inside the nix dev shell — running it outside will fail.
- Every module with non-trivial logic gets a test file. Pure functions get unit tests; DB-touching code gets integration tests against live PostgreSQL.
- Property-based tests use `npm:fast-check@3` for pure logic modules where properties are more valuable than examples (extractors, parsers, algorithms). Not for DB or HTTP tests. PBT files use `_prop_test.ts` suffix.
- Tests must clean up after themselves. Use `_test_` prefix for any DB side effects, delete in finally blocks.
- Keep test output minimal: no console.log of data, no dumping rows. Assert silently, report only pass/fail + failure detail.
- After implementing a task, run `scripts/run.sh bash -c 'scripts/unit-test.sh'` and confirm all green before reporting completion.

### Test Pitfalls
- **DB pool resource leaks:** Deno's resource sanitizers flag connections opened at module import time (e.g., the pool in `api/db.ts`). DB-touching test suites must disable sanitizers on the describe block: `{ sanitizeOps: false, sanitizeResources: false }`. Each test still cleans up its own side effects via finally blocks.
- **jsonb columns:** Cannot use `LIKE` directly on jsonb. Cast first: `column::text LIKE '%pattern%'`. Applies to cleanup queries in `tests/helpers.ts`.
- **Pool lifecycle:** Call `closePool()` from `api/db.ts` and `closeTestClient()` from `tests/helpers.ts` in test teardown to avoid TCP connection leaks.

## Architecture
- Monorepo: `/api` (Deno), `/capture` (SvelteKit frontend), `/db` (migrations).
- REST JSON API. Server-rendered pages where possible.
- Auth: local accounts with custom captcha. Session cookies. OIDC deferred.
- Capture-first approach: captures are the primary entity. See `PLAN.md` for full data model.
- Captures have: title, status (`***`/`**`/`*`/done), what, where_text, why, when, notes (all markdown except title).
- URL extraction from markdown fields → `capture_urls` table (no classification/metadata).
- Multiple images per capture via `capture_images` table.
- Geographic regions via `capture_regions` (S2 cells, schema exists but not auto-populated yet).
- User profiles: display_name, about, avatar.
- Previous approach archived in `attic/approach01/`. Do NOT reference archived files for current implementation.
- All data is public once authenticated. All API endpoints require authentication (session cookie).

## Workflow

**🚨 PLAN-BEFORE-CODE IS MANDATORY — NOT OPTIONAL 🚨**
**You MUST present a plan and receive explicit approval BEFORE making ANY code or file changes whatsoever. This applies to all modifications without exception: planned tasks, bug fixes, refactors, tweaks, corrections, deviations from the current flow, or anything else. No change is too small to skip this step. "continue" means "show me the plan for the next task", not "implement it".**

1. **Plan first.** Before ANY implementation, write a short plan describing:
   - What will change (files, components, behavior)
   - Why (which task/spec requirement this addresses)
   - Any trade-offs or decisions made
2. **Stop and wait.** Do NOT proceed until the user explicitly approves (e.g., "go", "approved", "looks good", "do it"). Silence or ambiguity is NOT approval.
3. **Then implement.** Only after approval, make the changes.
4. Always run tool commands via the dev shell: `scripts/run.sh deno check api/main.ts`. Never call `deno`, `pnpm`, `dbmate` etc. outside the shell.
5. Output diffs, not full file rewrites.
6. Never commit without explicit instruction.
7. Test migrations on empty DB before proceeding.
8. Build incrementally. Verify each layer before adding the next.

### Task Tracking Protocol

TODO.md checkbox conventions:
- `[x]` — done
- `[ ]` — pending (next up or planned)
- `[~]` — intentionally deferred/skipped (with reason noted). Not deleted; can be reactivated later.

1. Before starting a milestone, break it into discrete tasks in `TODO.md`.
2. Present the task list and wait for explicit approval.
3. Implement one task at a time. After completing each task:
   - Check the box in `TODO.md`.
   - Run `scripts/unit-test.sh` and confirm all tests pass.
   - Stop and report completion.
   - Wait for user input before proceeding to the next task.
4. Do not batch tasks. Do not proceed without acknowledgment.
5. If a task needs refinement mid-implementation, update `TODO.md` and confirm with the user.
6. After the user says "commit" and the commit is made, review the session for lessons learned (gotchas, tool quirks, patterns not captured in docs). If anything warrants recording, propose specific modifications to relevant `.md` files. Often there will be nothing — only propose when genuinely useful. Do **not** make any changes until the user approves.
