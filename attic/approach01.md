# Approach 01 Archive

- **Git commit:** `46bb53461ff00a7b5e064e576e791dea5c8c5dbc`
- **Archived:** 2026-08-22
- **Contents:** milestones/, TODO.md, PLAN.md, db/migrations/ (14 files)

## Summary

Full-stack issue tracker with typed issues (draft/problem/cause/action),
relations, regions, tags, citations, comments, votes, graph traversal.
Four frontends planned: Capture, Tracker, Community, Direct Action.
16 milestones defined, M1–M3 complete, M4 partially done.

## Why we changed direction

- Too many abstractions before delivering value — 14 DB tables before a single useful page
- Severity field didn't work at capture time (findings F001)
- Captures come from heterogeneous sources (URL paste, anecdote, book knowledge)
  and need different handling than a single "issue body" field
- Need progress tracking via status (`***`, `**`, `*`, done)
- Capture should be the entry point; everything else follows from it
- The existing data model conflated capture, refinement, and community features
- See `findings.md` for detailed reasoning

## What is preserved

- Auth system (users, sessions, captcha) — unchanged
- Nix flake + dev shell — unchanged
- SvelteKit frontend scaffold — reused
- General architecture (Deno API + SvelteKit frontends) — same

## What changes

- `issues` table → replaced by simpler `captures` table
- `issue_versions`, `comments`, `votes`, `tags`, `issue_tags`, `issue_relations` → dropped
- `citations` table → replaced by simple `capture_urls` (no classification/metadata)
- `issue_regions` → `capture_regions` (kept, but not auto-populated yet)
- Image upload → multiple images per capture via `capture_images` table
- New: user profile (display_name, about, avatar)
- New: URLs view aggregating all URLs across user's captures
- New: quick-capture smart field (URL→title, image→attach, text→title)
