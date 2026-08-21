# AGENTS.md

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

## Architecture
- Monorepo: `/api` (Deno), `/web` (Svelte), `/db` (migrations).
- REST JSON API. Server-rendered pages where possible.
- Auth: OIDC + local accounts with custom captcha. Session cookies.
- Three views: Direct Action, Pundit (discussion/voting), Tracker (GitHub-like).
- Issues typed as problem/cause/action with hierarchical decomposition.
- Multi-region via S2 cells. Relations form a directed graph.

## Workflow
- Plan before code. Get approval before implementing.
- Output diffs, not full file rewrites.
- Never commit without explicit instruction.
- Test migrations on empty DB before proceeding.
- Build incrementally. Verify each layer before adding the next.
