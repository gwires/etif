# Everything Fucked — Planetary Issue Tracker

## Concept
A website tracking problems on planet Earth. Like a GitHub issue tracker but with:
1. Multi-region geographic association per issue (S2 geometry)
2. Issues form a directed network (causes, parent-of, related-to)
3. Three distinct user perspectives

## Tech Stack
- **Nix flake**: dev shell with deno, pnpm, node, dbmate, postgresql, libpq
- **PostgreSQL + dbmate**: schema migrations, pg_s2 extension for spatial indexing
- **Deno backend**: lightweight HTTP API (std/http or Oak), minimal deps
- **Svelte frontend**: SvelteKit via pnpm, thin client layer, server-rendered
- **Auth**: OIDC OAuth + local accounts (username/password, no email, custom captcha)

## Data Model

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| username | text UNIQUE NOT NULL | |
| password_hash | text NULLABLE | null for OAuth-only users |
| oidc_sub | text NULLABLE | OIDC subject identifier |
| oidc_issuer | text NULLABLE | OIDC issuer URL |
| created_at | timestamptz | |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| token_hash | text NOT NULL | hashed session token |
| expires_at | timestamptz | |

### captcha_challenges
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| challenge_data | jsonb | e.g. math expression, logic puzzle |
| answer_hash | text | hashed correct answer |
| expires_at | timestamptz | short-lived |

### tags
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text UNIQUE NOT NULL | ontology term, e.g. "climate", "energy" |
| parent_tag_id | uuid FK → tags NULLABLE | hierarchical ontology tree |
| description | text | markdown |

### issue_tags
| Column | Type | Notes |
|--------|------|-------|
| issue_id | uuid FK → issues | composite PK (issue_id, tag_id) |
| tag_id | uuid FK → tags | |

### issues
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text NOT NULL | |
| body | text | markdown description |
| image_path | text NULLABLE | relative path to card image |
| type | enum(problem, cause, action) | hierarchy level |
| status | enum(open, in_progress, resolved, wontfix) | workflow |
| severity | smallint | 1-5 scale |
| score | int DEFAULT 0 | cached vote tally |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### issue_regions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| issue_id | uuid FK → issues | |
| s2_cell_id | bigint NOT NULL | S2 cell at appropriate level |
| region_name | text | human-readable label |

Index on s2_cell_id for spatial queries.

### issue_relations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| source_id | uuid FK → issues | |
| target_id | uuid FK → issues | |
| relation_type | enum(causes, parent_of, related_to) | directed edge |
| body | text NULLABLE | markdown explaining *why* this relation exists |

Unique constraint on (source_id, target_id, relation_type).

### comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| issue_id | uuid FK → issues | |
| user_id | uuid FK → users | |
| parent_comment_id | uuid FK → comments NULLABLE | threaded replies |
| body | text NOT NULL | |
| score | int DEFAULT 0 | cached vote tally |
| created_at | timestamptz | |

### votes
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid FK → users | |
| target_type | enum(issue, comment) | polymorphic target |
| target_id | uuid | references issues or comments |
| value | smallint | +1 or -1 |

Unique constraint on (user_id, target_type, target_id).

## Four Views

### I. Direct Action View (landing page)
- Shows actionable items (issues where type = 'action')
- Each action card includes context trail back to root problem
- Geo-filtered by visitor location / selected region
- Example chain: Climate Change → Fossil Fuel Funding → Your Bank Funds Oil → **Switch to ethical bank**
- Minimal UI: card feed with expandable context

### II. Pundit View (community)
- Reddit-style discussion threads on any issue
- Upvote/downvote on issues and comments
- Sort: hot / new / top / controversial
- Tags/flairs on issues
- Threaded comment tree

### III. Tracker View (GitHub-like)
- Filterable issue list (type, status, severity, region, tags)
- Detail page: body, image card, tags, sub-issue tree, relation graph, map
- Map view: S2 cells rendered as polygons overlay
- Graph view: interactive DAG visualization of issue relations
- Status workflow: open → in_progress → resolved → wontfix

### IV. Relational View (card network)
- Centered large card for the focal issue (image + title + summary)
- Incoming relation cards (smaller) fanned on the left
- Outgoing relation cards (smaller) fanned on the right
- Each mini-card shows image thumbnail, title, relation type label, relation body excerpt
- Click any card to navigate to that issue's relational view
- Keyboard nav: ← → to traverse, enter to focus
- Visual metaphor: trading card / collectible card layout

## Auth Flow

### OIDC
1. User clicks "Sign in with [provider]"
2. Redirect to OIDC authorization endpoint
3. Callback exchanges code for tokens
4. Upsert user by (oidc_sub, oidc_issuer), create session

### Local Signup
1. GET /api/captcha → returns challenge (math/logic puzzle)
2. POST /api/signup with username, password, captcha_answer
3. Server validates captcha, hashes password, creates user + session
4. Session cookie set (http-only, signed)

### Custom Captcha
- Server-generated puzzles: arithmetic, word logic, pattern matching
- Stored in captcha_challenges with hashed answer
- Short expiry (5 min), single-use
- No external services, no JS required to solve

## API Endpoints

```
POST   /api/auth/captcha
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/oidc/callback
DELETE /api/auth/session

GET    /api/issues
POST   /api/issues
GET    /api/issues/:id
PATCH  /api/issues/:id
GET    /api/issues/:id/relations       # incoming + outgoing with bodies
POST   /api/issues/:id/relations
PATCH  /api/relations/:id               # edit relation body
DELETE /api/relations/:id

GET    /api/tags                         # full ontology tree
POST   /api/tags
DELETE /api/tags/:id
POST   /api/issues/:id/tags              # attach tag
DELETE /api/issues/:id/tags/:tag_id      # detach tag

GET    /api/issues/:id/card              # issue + image + adjacent cards (relational view)
GET    /api/issues/:id/comments
POST   /api/issues/:id/comments
POST   /api/votes

GET    /api/regions?s2_cell_id=...
GET    /api/actions?region=...          # direct action feed
GET    /api/graph?root=...             # issue network traversal
```

## Frontend Routes

```
/                              → redirect to /actions or last-viewed perspective
/signup                        → local signup form + captcha
/login                         → login form (local + OIDC buttons)
/auth/callback                 → OIDC callback handler
/logout                        → destroy session

/actions                       → Direct Action view (landing)
/actions?region=<s2>           → geo-filtered actions
/pundit                        → Pundit view (issue feed, sorted)
/pundit?sort=hot|new|top       → sorted feeds
/tracker                       → Tracker view (filterable issue list)
/tracker?type=&status=&tag=    → filtered list
/map                           → full-screen map view (S2 overlay)

/i/:id                         → issue detail (tracker-style)
/i/:id/relational              → Relational card view (centered card + neighbors)
/i/:id/discuss                 → Pundit discussion thread for this issue

/t/:tag                        → issues filtered by tag (ontology browse)
/t/:tag/tree                   → ontology subtree explorer

/u/:username                   → user profile (their issues, comments, votes)
/settings                      → account settings
```

## Milestones

1. **Flake + dev shell** — nix flake providing all tools
2. **DB migrations** — all tables, indexes, enums via dbmate
3. **Auth** — OIDC flow, local signup with captcha, session management
4. **Core API** — CRUD issues, relations, regions, comments, votes
5. **Tags + ontology** — tag CRUD, hierarchical ontology, issue tagging
6. **Image upload** — card image attachment for issues
7. **Relation bodies** — markdown descriptions on relations
8. **Frontend shell** — SvelteKit app with routing, four-view layout
9. **Direct Action view** — action card feed with context trails
10. **Pundit view** — discussion threads, voting
11. **Tracker view** — issue list, detail page, graph/map views
12. **Relational view** — centered card + incoming/outgoing card fan
13. **Seed data** — climate change hierarchy with example actions and images

## Design Principles
- Server-rendered HTML wherever possible
- Single small CSS file, no frameworks
- Unicode/text over icon libraries
- Minimal client-side JS
- Incremental builds, memory-conscious
- Deno std preferred over third-party packages
