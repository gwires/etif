# Milestone 14: Community Frontend

## Goal
Build the Community frontend — Wikipedia talk-page meets HN/SO discussion around issues and their versions.

## Prerequisites
- Milestones 9, 13 complete (versions API working, tracker patterns established)
- Comments and votes API from milestone 4

## Project Setup
```bash
pnpm create svelte@latest community --template skeleton-typescript
cd community && pnpm install
```

## Deliverables

### 1. Community Feed

**`/community`** (`src/routes/community/+page.svelte`)
- Issue feed sorted by activity (recent comments, votes)
- Sort options: hot, new, top, controversial
- Each entry: title, type badge, score, comment count, last activity time
- Filter by tag, type
- Pagination
- No auth required for reading

**Sort algorithms:**
- `new`: by created_at desc
- `top`: by score desc
- `hot`: score / (age_hours + 2)^1.5 (Hacker News style)
- `controversial`: high comment count + close vote ratio (many up AND down votes)

Implement sort in SQL where possible. Hot/controversial may need computed columns or application-level sorting on paginated results.

### 2. Issue Discussion Page

**`/i/[id]/discuss`** (`src/routes/i/[id]/discuss/+page.svelte`)

Wikipedia talk-page style:
- Issue summary at top (title, body excerpt, current version info)
- Tab navigation: Discussion | Versions | Citations | Relations
- **Discussion tab**: threaded comments (same component as tracker but with different styling — more compact, forum-like)
- Comment form with markdown support
- Reply-to-comment creates nested thread
- Vote buttons on each comment
- Sort comments by: top, newest, oldest

### 3. Versions Tab

**`/i/[id]/versions`** (tab within discuss page or separate route)
- List all versions with diff-like comparison
- Each version row: version number, edited_by, date, title, body excerpt, score
- Click to expand full body
- Vote buttons per version (which version is best?)
- "Propose new version" button → opens edit form
- Proposed version starts as a suggestion (could be a special comment type or just a new version with low score)

### 4. Version Comparison

Simple text diff display between two versions:
- Side-by-side or inline
- Use a minimal diff algorithm (Myers diff, ~100 lines of code)
- Highlight added/removed lines
- No external diff library — implement basic word-level diff

### 5. Suggest Edit Flow

When user proposes a new version:
1. Show edit form pre-filled with current issue state
2. User modifies title/body
3. POST /api/issues/:id/versions (creates version without updating current issue)
4. New version appears in versions list for community voting
5. If a version gets significantly higher score than current, flag for promotion (future feature, just display scores for now)

### 6. Shared Patterns from Tracker

Reuse from tracker frontend (copy or shared package):
- CommentTree component (restyled for forum look)
- VoteButtons component
- MarkdownRenderer
- TagChip
- API client

Restyle for community aesthetic: denser layout, smaller text, more information per screen. Think HN/Reddit vs GitHub.

## Verification
```bash
cd community
pnpm dev
# Visit /community, verify feed with sort options
# Click into discussion, verify threaded comments
# Switch to versions tab, verify version history
# Propose a new version, verify it appears
# Vote on versions and comments
```

## Constraints
- Separate SvelteKit app. Independent from capture and tracker.
- Diff algorithm implemented in-app, no heavy libraries.
- SSR for all pages.
- Single CSS file. Dense, readable typography.
- No real-time updates (no WebSockets). Manual refresh or polling optional.
- Memory-conscious: paginate feeds, don't preload all versions.
- Bundle target: < 60KB gzipped.
