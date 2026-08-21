# Milestone 13: Tracker Frontend

## Goal
Build the Tracker frontend — a SvelteKit app providing GitHub-like issue management with relational card view and map visualization.

## Prerequisites
- Milestones 4-9 complete (full API available)
- Milestone 11 patterns established (auth, API client, styles)

## Project Setup
```bash
pnpm create svelte@latest tracker --template skeleton-typescript
cd tracker && pnpm install
```

Separate SvelteKit app from Capture. Shares same API backend. Can share code via a local package or copy patterns.

## Deliverables

### 1. Issue List Page

**`/tracker`** (`src/routes/tracker/+page.svelte`)
- Filterable table/list of issues (non-draft types only)
- Filters: type (problem/cause/action), status, severity range, tag, region
- Sort: created_at, updated_at, score
- Pagination (limit/offset)
- Each row: title, type badge, status badge, severity indicator, score, tag chips, region count
- Click title → /i/:id

### 2. Issue Detail Page

**`/i/[id]`** (`src/routes/i/[id]/+page.svelte`)
- Header: title, type badge, status badge, severity, score, created_by, dates
- Body: rendered markdown
- Image card display (if image_path set)
- Tags section with links to /t/:tag
- Citations section grouped by type
- Regions list with S2 cell IDs
- Relations section: incoming and outgoing with relation bodies
- Sub-issue tree (parent_of relations rendered as nested list)
- Comments section (threaded, sorted by score or date)
- Comment form (auth required)
- Vote buttons on issue (up/down, shows current score)
- Edit link → /i/:id/edit (in capture frontend or inline)

### 3. Relational Card View

**`/i/[id]/relational`** (`src/routes/i/[id]/relational/+page.svelte`)

Trading card layout:
- Center: large card for focal issue (image, title, short description, type badge)
- Left fan: incoming relation cards (smaller), each showing:
  - Thumbnail image (or placeholder)
  - Title (truncated)
  - Relation type label ("caused by", "parent of", "related to")
  - Relation body excerpt (first 80 chars)
- Right fan: outgoing relation cards (same format)
- Click any card → navigate to that issue's relational view
- Keyboard navigation: ← → arrows to move between cards, Enter to focus center card
- CSS-only fan layout using transforms (rotate + translate)
- Max 8 cards per side, overflow shown as "+N more" with expand option

Data source: GET /api/issues/:id/card (returns issue + adjacent cards)

### 4. Map View

**`/map`** (`src/routes/map/+page.svelte`)
- Full-screen map display
- Use Leaflet.js (lightweight, ~40KB gzipped) or plain OpenStreetMap tiles
- Load S2 cell regions as polygons overlay
- Color-code by issue type or severity
- Click polygon → show issue summary popup with link to detail page
- Lazy-load regions based on viewport bounds
- No auth required

If Leaflet is too heavy, use a static tile renderer with clickable SVG overlays. Document trade-off.

### 5. Tag Browse Pages

**`/t/[tag]`** (`src/routes/t/[tag]/+page.svelte`)
- Issues filtered by this tag
- Same layout as /tracker but pre-filtered
- Tag description at top
- Breadcrumb showing parent tags

**`/t/[tag]/tree`** (`src/routes/t/[tag]/tree/+page.svelte`)
- Ontology subtree visualization
- Expandable/collapsible tree
- Issue counts per tag node
- Click tag name → /t/:tag

### 6. User Profile

**`/u/[username]`** (`src/routes/u/[username]/+page.svelte`)
- User info: username, joined date
- Tabs: Issues created, Comments, Votes
- Each tab paginated
- No auth required (public profiles)

### 7. Settings Page

**`/settings`** (`src/routes/settings/+page.svelte`)
- Account info display
- Change password (for local accounts)
- Linked OIDC providers
- Auth required

### 8. Shared Components

Keep minimal. Only extract components used in 3+ places:
- `IssueCard.svelte` — card display used in list, relational view, tag browse
- `CommentTree.svelte` — threaded comment rendering
- `VoteButtons.svelte` — up/down vote widget
- `TagChip.svelte` — small tag badge with link
- `MarkdownRenderer.svelte` — basic markdown to HTML (use a tiny parser, no heavy libs)

Everything else: inline in pages. Don't over-componentize.

## Verification
```bash
cd tracker
pnpm dev
# Visit /tracker, verify issue list with filters
# Click an issue, verify detail page
# Navigate to /i/:id/relational, verify card fan layout
# Visit /map, verify regions display
# Browse /t/environment, verify tag filtering
```

## Constraints
- Separate SvelteKit app from Capture. Independent build and deploy.
- Leaflet is the heaviest dependency allowed. Justify if adding anything larger.
- SSR for all pages except map (map requires client-side JS for tile rendering).
- Single CSS file shared across tracker frontend.
- No component library. No icon library. Unicode/text/SVG only.
- Memory-conscious: don't run capture and tracker dev servers simultaneously.
- Paginate everything. Never load unbounded lists.
- Total bundle target: < 80KB gzipped (excluding Leaflet).
