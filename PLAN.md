# Everything Fucked — Capture-First Tracker

## Concept
A platform for capturing things that are fucked up on planet Earth.
Start with capture as the entry point; refinement, tracking, community,
and action features follow later.

## Approach 02: Capture-First

Previous approach (archived in `attic/approach01/`) built a full issue tracker
with 14 tables before delivering a single useful page. This approach starts
with a minimal capture model and grows incrementally.

### Core idea
Three main questions per capture:
- **What** — what is fucked up (short description)
- **Where** — where does this take place
- **Why** — why is it so bad

Plus supporting fields: title, status, when, notes, images, URLs.

### Capture sources
1. **News article** — paste URL, auto-fill title, add notes
2. **Anecdotal observation** — write directly, maybe attach photos
3. **Prior knowledge** — from a book, past experience, general thought

### Progress tracking via status
- `***` — very rough, just captured a URL or single word
- `**` — getting there, some fields filled
- `*` — nearly done, minor polish needed
- *(empty)* — complete/polished

Status is stored as a DB column. Displayed as star prefix on title in UI.

## Tech Stack
- **Nix flake**: dev shell with deno, pnpm, node, dbmate, postgresql, libpq
- **PostgreSQL + dbmate**: schema migrations
- **Deno backend**: lightweight HTTP API, minimal deps
- **Svelte 5 frontend**: SvelteKit via pnpm, runes mode, server-rendered
- **Auth**: local accounts (username/password, custom captcha), OIDC deferred

## Data Model

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| username | text UNIQUE NOT NULL | |
| password_hash | text NULLABLE | null for OAuth-only users |
| display_name | text NULLABLE | shown in UI instead of username |
| about | text NULLABLE | markdown bio |
| avatar_path | text NULLABLE | relative path under /data/avatars/ |
| oidc_sub | text NULLABLE | future: OIDC subject |
| oidc_issuer | text NULLABLE | future: OIDC issuer |
| created_at | timestamptz | |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| token_hash | text NOT NULL | |
| expires_at | timestamptz | |

### captcha_challenges
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| challenge_data | jsonb | |
| answer_hash | text | |
| expires_at | timestamptz | |

### captures
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| title | text NOT NULL | plain text, no embedded stars |
| status | text NOT NULL DEFAULT '***' | `***`, `**`, `*`, or empty |
| what_text | text NULLABLE | markdown |
| where_text | text NULLABLE | markdown, free-text location |
| why_text | text NULLABLE | markdown |
| when_text | text NULLABLE | markdown, temporal context |
| notes | text NULLABLE | markdown |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### capture_urls
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| capture_id | uuid FK → captures | |
| url | text NOT NULL | |
| created_at | timestamptz | |

Extracted from all markdown fields on save. Delete+re-insert on update.
Aggregated into per-user "urls" view.

### capture_images
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| capture_id | uuid FK → captures | |
| path | text NOT NULL | relative path under /data/images/ |
| caption | text NULLABLE | markdown, user-editable |
| sort_order | int DEFAULT 0 | ordering within a capture |
| created_at | timestamptz | |

Multiple images per capture. Future: OCR processing.

### capture_regions
| Column | Type | Notes |
|--------|------|-------|
| capture_id | uuid FK → captures | |
| s2_cell | bigint | S2 cell token |
| label | text | human-readable region name |

Geographic regions. Kept in schema but not auto-populated yet.
Future: extract from `where_text`.


## Quick-Capture Smart Field

Single input field on the capture form with smart behavior:

| Input | Detection | Action |
|-------|-----------|--------|
| URL pasted | Regex `https?://...` | Fetch page title → fill title, set status=`***`, append URL to notes |
| Image pasted/dropped | File/blob | Attach image(s), set status=`***`, focus title field |
| Plain text | Fallback | Fill title, set status=`***` |

All frontend orchestration. API receives normal create/update calls.

## URL Handling

On capture create/update:
1. Extract URLs from what_text, where_text, why_text, when_text, notes (markdown links + bare URLs)
2. Delete existing `capture_urls` for that capture
3. Re-insert fresh set
4. The quick-capture URL also goes into notes, so it gets picked up naturally

No classification, no metadata fetching. Just URLs. Can upgrade to full
citations later if needed.

User-level "urls" view: `SELECT cu.url, c.title, c.status, c.created_at
FROM capture_urls cu JOIN captures c ON ... WHERE c.user_id = ? ORDER BY cu.created_at DESC`

## API Endpoints

```
POST   /api/auth/captcha
POST   /api/auth/signup
POST   /api/auth/login
DELETE /api/auth/session
GET    /api/auth/me                    (extended: includes profile fields)
PATCH  /api/auth/profile               (display_name, about)
POST   /api/auth/avatar                (upload avatar image)
DELETE /api/auth/avatar                (remove avatar)

GET    /api/captures                   (list, filterable by status)
POST   /api/captures                   (create, triggers URL extraction)
GET    /api/captures/:id
PATCH  /api/captures/:id               (update, re-extracts URLs)
DELETE /api/captures/:id

POST   /api/captures/:id/images        (upload image, multipart)
DELETE /api/captures/:id/images/:img_id

GET    /api/urls                       (aggregated URL list for user)
```

## Frontend Routes (Capture Frontend)

```
/signup                        → signup form + captcha
/login                         → login form
/logout                        → destroy session

/capture                       → new capture form (quick-capture field)
/capture/recent                → recent captures feed
/i/:id/edit                    → edit existing capture
/urls                          → all URLs across user's captures
/profile                       → edit profile (display_name, about, avatar)
```

## Future Work (not in current milestones)

- Link extraction with LLM-assisted field prefill
- Citations table with classification/metadata (upgrade from capture_urls)
- Auto-populate regions from where_text
- OCR on capture_images
- Refinery: promote captures, LLM suggestions
- Tracker frontend: filterable list, map, graph
- Community frontend: discussion, voting
- Direct Action frontend: geo-filtered actions
- Relations between captures
- Tags/ontology
- Issue versions, comments, votes
- OIDC auth
- Data dumps, backup/restore

## Design Principles
- Minimal code, minimal CSS, minimal dependencies
- Server-rendered HTML wherever possible
- Single small CSS file, no frameworks
- Unicode/text over icon libraries
- Deno std preferred over third-party packages
- Each frontend is a separate SvelteKit app
- Everything is public once authenticated
