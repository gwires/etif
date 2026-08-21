# Milestone 15: Direct Action Frontend

## Goal
Build the Direct Action frontend — shows actionable items to end users with context trails back to root problems. Geo-filtered.

## Prerequisites
- Milestones 4-7 complete (issues, relations, regions, tags API)
- At least one other frontend built (patterns established)

## Project Setup
```bash
pnpm create svelte@latest action --template skeleton-typescript
cd action && pnpm install
```

## Deliverables

### 1. Action Feed (Landing Page)

**`/actions`** (`src/routes/actions/+page.svelte`)
- Shows issues where `type = action` and `status != wontfix`
- Each action card displays:
  - Title
  - Short description (body excerpt)
  - Image thumbnail if available
  - Severity indicator
  - Score
  - Context trail: breadcrumb path from root problem → ... → this action
    Example: Climate Change → Fossil Fuel Industry → Bank Funding → **Switch Bank**
  - Region relevance indicator
- Sort by: score (default), severity, newness, regional relevance
- Pagination

### 2. Geo-Filtering

**Region selector at top of feed:**
- Dropdown/search for region name
- Optional: browser geolocation button ("Use my location")
  - If granted: convert lat/lng to S2 cell, filter actions by overlapping regions
  - If denied or unavailable: show all actions, prompt manual selection
- URL param: `?region=<s2_cell_id>` for shareable filtered views
- "Global" option to see all actions regardless of region

**Backend query**: GET /api/actions?region=<s2_cell_id>
- If no existing endpoint covers this, add it:
  - Query issues WHERE type='action'
  - JOIN issue_regions WHERE s2_cell_id matches (or is ancestor/descendant)
  - Fall back to all actions if no region specified

### 3. Context Trail Component

**ContextTrail component:**
- Given an action issue, walk up parent_of relations to build trail
- Display as horizontal breadcrumb or vertical mini-cards
- Each node in trail: title + type badge, clickable link to that issue's detail
- Max depth: 6 levels (prevent infinite loops in graph)
- Data source: GET /api/graph?root=<action_id>&direction=incoming&depth=6
  - Filter edges to only parent_of type for clean hierarchy

### 4. Action Detail View

Click an action card → expands inline or navigates to detail:
- Full body text (markdown rendered)
- Full context trail
- Related actions (same parent cause)
- Citations supporting this action
- Vote buttons
- Comments section (read-only or link to community frontend for discussion)
- "I did this" button (future feature — just a bookmark/count for now)

### 5. Progress Indicators

For each action, show:
- How many people voted on it (score)
- Parent problem severity (context for urgency)
- Number of related actions (alternatives)

Keep visual indicators minimal — text/badges, no progress bars or charts.

### 6. Design Notes

This frontend has a different audience (general public, not researchers/trackers). Design priorities:
- Clear, actionable language
- Minimal jargon
- Visual hierarchy emphasizing what to DO
- Mobile-first (people browsing on phones)
- Fast load time critical

## Verification
```bash
cd action
pnpm dev
# Visit /actions, verify action cards display
# Check context trails render correctly
# Try geo-filtering (manual region selection)
# Click an action, verify detail view
# Verify breadcrumbs navigate correctly
```

## Constraints
- Separate SvelteKit app. Lightest of all four frontends.
- No map library needed (unlike tracker). Region selection via dropdown/search only.
- SSR critical for SEO (this is the public-facing landing page).
- Single CSS file. Mobile-first responsive design.
- Bundle target: < 40KB gzipped. Smallest frontend.
- No auth required for reading. Auth only for voting.
- Memory-conscious: paginate feed, lazy-load context trails.
