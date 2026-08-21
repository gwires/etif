# Everything Fucked — Planetary Issue Tracker

## Concept
A platform tracking problems on planet Earth. Issues form a network with geographic associations. Four separate frontends serve different audiences:

1. **Capture** — quick entry + refinement of issues (build first)
2. **Tracker** — GitHub-like issue management
3. **Community** — Wikipedia talk-page meets HN/SO discussion
4. **Direct Action** — actionable items for end users

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

### citations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| url | text NOT NULL | original URL |
| type | enum(video, article, news, location, other) | classified link type |
| title | text NULLABLE | extracted or manual |
| author | text NULLABLE | |
| published_at | timestamptz NULLABLE | |
| summary | text NULLABLE | extracted snippet / description |
| archive_path | text NULLABLE | path to archived copy |
| created_at | timestamptz | |

### issue_citations
| Column | Type | Notes |
|--------|------|-------|
| issue_id | uuid FK → issues | composite PK (issue_id, citation_id) |
| citation_id | uuid FK → citations | |

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
| type | enum(draft, problem, cause, action) | draft = unrefined capture |
| status | enum(open, in_progress, resolved, wontfix) | workflow |
| severity | smallint | 1-5 scale |
| score | int DEFAULT 0 | cached vote tally |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### issue_versions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| issue_id | uuid FK → issues | |
| version | int NOT NULL | monotonically increasing per issue |
| title | text NOT NULL | snapshot of title at this version |
| body | text | snapshot of body |
| image_path | text NULLABLE | |
| edited_by | uuid FK → users | |
| created_at | timestamptz | |

Versions allow the community to improve cards and vote on specific versions.

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
| target_type | enum(issue, issue_version, comment) | polymorphic target |
| target_id | uuid | references issues, issue_versions, or comments |
| value | smallint | +1 or -1 |

Unique constraint on (user_id, target_type, target_id).

## Four Frontends

### I. Capture Frontend (build first)
Quick entry and refinement of issues. Requires auth. Nothing is private.

**Draft entry:**
- Minimal form: markdown textarea with title
- Paste links freely (videos, articles, news, Google Maps / OSM URLs)
- On save: backend extracts URLs from markdown body → creates citations → links to issue
- Location URLs (google.com/maps, openstreetmap.org) → extract coordinates → create S2 cells → issue_regions
- New issues start as `type = draft`

**Refinery:**
- Lists all drafts, filterable/sortable
- Refine a draft into a card: LLM-assisted step that proposes title, short description, image suggestion
- User reviews/edits the proposal, confirms → issue promoted from draft to problem/cause/action
- Can also manually fill fields without LLM assistance

**Everything is public:** drafts visible to all, refinement history visible.

### II. Tracker Frontend (build second)
GitHub-like issue management.

- Filterable issue list (type, status, severity, region, tags)
- Detail page: body, image card, tags, sub-issue tree, relation graph, map
- Map view: S2 cells rendered as polygons overlay
- Graph/network view: DAG visualization of issue relations
- Relational card view: centered large card + incoming/outgoing mini-cards fanned left/right
- Status workflow: open → in_progress → resolved → wontfix

### III. Community Frontend (build later)
Wikipedia talk-page meets HN/SO/StackOverflow.

- Refined discussion around issues and their versions
- Upvote/downvote on issue versions (which version is best?)
- Threaded comments on issues
- Sort: hot / new / top / controversial
- Suggest edits → create new version → community votes
- Tags/flairs on issues

### IV. Direct Action Frontend (build later)
Actionable items for end users.

- Shows issues where type = 'action'
- Each action card includes context trail back to root problem
- Geo-filtered by visitor location / selected region
- Example: Climate Change → Fossil Fuel Funding → Your Bank Funds Oil → **Switch to ethical bank**

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

## Link Extraction & Citations

On issue save/update:
1. Parse markdown body for URLs
2. For each URL, classify type:
   - youtube.com, vimeo.com, etc → `video`
   - google.com/maps, openstreetmap.org → `location` (extract lat/lng)
   - Known news domains → `news`
   - Else → `article` (fetch title/description if possible)
3. Upsert into `citations` table (deduplicate by URL)
4. Link to issue via `issue_citations`
5. Location URLs additionally create `issue_regions` entries

Future: archive URLs (save PDF/screenshot/MHTML to `archive_path`).

## API Endpoints

```
POST   /api/auth/captcha
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/oidc/callback
DELETE /api/auth/session

GET    /api/issues
POST   /api/issues                    # creates draft, extracts citations
GET    /api/issues/:id
PATCH  /api/issues/:id                # re-extracts citations on body change
GET    /api/issues/:id/citations
GET    /api/issues/:id/versions
POST   /api/issues/:id/refine         # promote draft → card (optionally LLM-assisted)

GET    /api/issues/:id/relations       # incoming + outgoing with bodies
POST   /api/issues/:id/relations
PATCH  /api/relations/:id              # edit relation body
DELETE /api/relations/:id

GET    /api/tags                       # full ontology tree
POST   /api/tags
DELETE /api/tags/:id
POST   /api/issues/:id/tags            # attach tag
DELETE /api/issues/:id/tags/:tag_id     # detach tag

GET    /api/issues/:id/card            # issue + image + adjacent cards (relational view)
GET    /api/issues/:id/comments
POST   /api/issues/:id/comments
POST   /api/votes

GET    /api/regions?s2_cell_id=...
GET    /api/actions?region=...         # direct action feed
GET    /api/graph?root=...            # issue network traversal
GET    /api/drafts                     # refinery: list drafts
```

## Frontend Routes

### Capture Frontend
```
/signup                        → local signup form + captcha
/login                         → login form (local + OIDC buttons)
/auth/callback                 → OIDC callback handler
/logout                        → destroy session

/capture                       → new issue draft form
/capture/recent                → recent drafts (public feed)
/refine                        → refinery: list drafts needing refinement
/refine/:id                    → refine a specific draft into a card
/i/:id/edit                    → edit existing issue (re-triggers extraction)
/i/:id/history                 → version history
```

### Tracker Frontend
```
/tracker                       → filterable issue list
/tracker?type=&status=&tag=    → filtered list
/map                           → full-screen map view (S2 overlay)
/i/:id                         → issue detail (tracker-style)
/i/:id/relational              → relational card view (centered + fans)
/t/:tag                        → issues filtered by tag
/t/:tag/tree                   → ontology subtree explorer
/u/:username                   → user profile
/settings                      → account settings
```

### Community Frontend (later)
```
/community                     → issue feed sorted by activity
/community?sort=hot|new|top    → sorted feeds
/i/:id/discuss                 → discussion thread for issue
/i/:id/versions                → browse/vote on versions
```

### Direct Action Frontend (later)
```
/actions                       → action card feed
/actions?region=<s2>           → geo-filtered actions
```

## Data Dumps
All data available as read-only dumps for transparency and external use.

- **API endpoints**: `GET /api/dump/issues`, `GET /api/dump/citations`, `GET /api/dump/relations`, `GET /api/dump/tags` — return full tables as JSON or JSONL
- **Periodic full dump**: script generates timestamped archive (JSON + SQL) at `/dumps/YYYY-MM-DD.tar.gz`
- **Incremental**: optional since-datetime parameter for delta dumps
- **No auth required**: dumps are public
- **Formats**: JSON (default), JSONL (streaming-friendly), raw SQL (`pg_dump --data-only`)

## Seed Ontology (side note)
Initial scaffolding data to bootstrap the issue graph. Format and tooling TBD.

- Collection of markdown documents with YAML frontmatter defining issues, relations, tags, citations
- Existing frameworks to draw from:
  - Planetary Boundaries (Rockström et al.)
  - Capitalism critique / anarcho-communism theory
  - Cybernetics / systems thinking
  - IPCC reports / climate science taxonomy
  - SDGs / UN framework
- Each `.md` file = one issue seed: frontmatter has type, tags, relations, regions; body = description + links
- Import script parses frontmatter → creates issues, relations, tags, citations in DB
- This is a living corpus, not static seed data — evolves alongside user-generated content
- Open question: how to merge imported ontology with community-refined cards? Version conflicts? Trust scores?

## Milestones

Detailed specs for each milestone are in `milestones/MILESTONE-NNN.md`.

| # | Milestone | File | Summary |
|---|-----------|------|--------|
| 1 | Flake + dev shell | `MILESTONE-001.md` | Nix flake with deno, pnpm, node, dbmate, postgresql |
| 2 | DB migrations | `MILESTONE-002.md` | 14 migration files: all tables, enums, indexes with exact SQL |
| 3 | Auth | `MILESTONE-003.md` | Captcha, local signup/login, OIDC, session cookies |
| 4 | Core API | `MILESTONE-004.md` | Issues CRUD, relations, regions, comments, votes, graph traversal |
| 5 | Link extraction + citations | `MILESTONE-005.md` | URL parsing, classification, citation storage from markdown |
| 6 | Location extraction | `MILESTONE-006.md` | Maps URLs → coordinates → S2 cells → issue_regions |
| 7 | Tags + ontology | `MILESTONE-007.md` | Hierarchical tags CRUD, issue tagging, filtered queries |
| 8 | Image upload | `MILESTONE-008.md` | File upload, magic-byte validation, static serving |
| 9 | Issue versions | `MILESTONE-009.md` | Version snapshots on edit, version voting, history |
| 10 | Data dumps | `MILESTONE-010.md` | Streaming JSONL endpoints, periodic archive script |
| 11 | Capture frontend | `MILESTONE-011.md` | SvelteKit app: auth pages, draft form, recent feed |
| 12 | Refinery + LLM assist | `MILESTONE-012.md` | Promote drafts to cards, optional LLM suggestions |
| 13 | Tracker frontend | `MILESTONE-013.md` | Issue list, detail, relational card view, map, tag browse |
| 14 | Community frontend | `MILESTONE-014.md` | Discussion threads, version voting, diffs, HN-style feed |
| 15 | Direct Action frontend | `MILESTONE-015.md` | Action card feed, context trails, geo-filtering |
| 16 | Seed ontology import | `MILESTONE-016.md` | Markdown+frontmatter format, import script, initial corpus |

## Design Principles
- Server-rendered HTML wherever possible
- Single small CSS file per frontend, no frameworks
- Unicode/text over icon libraries
- Minimal client-side JS
- Incremental builds, memory-conscious
- Deno std preferred over third-party packages
- Each frontend is a separate SvelteKit app (shared API, independent deploy)
- Everything is public: no private content, no access control beyond auth for writing
