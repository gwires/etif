# Milestone 4: Core API

## Goal
CRUD endpoints for issues, relations, regions, comments, and votes. Auth middleware from milestone 3 is used to protect write operations.

## Prerequisites
- Milestone 3 complete (auth working, session middleware available)
- DB tables exist

## Deliverables

### 1. Issues CRUD (`/api/issues/`)

**GET /api/issues**
- Query params: `type`, `status`, `severity`, `tag`, `region` (s2_cell_id), `sort` (created_at, score, updated_at), `order` (asc/desc), `limit` (default 50, max 200), `offset`
- Returns array of issue objects with tags and region count
- No auth required (public read)

**POST /api/issues** (auth required)
```json
{ "title": "...", "body": "markdown with links...", "severity": 3 }
```
- Creates issue with `type = draft`, `status = open`
- Sets `created_by` from session
- Citation extraction will be added in milestone 5 — for now just store body as-is
- Returns created issue

**GET /api/issues/:id**
- Full issue with tags, citations (count only for now), regions, relation counts
- No auth required

**PATCH /api/issues/:id** (auth required)
- Update title, body, severity, status, type
- If body changed, citation re-extraction triggers (milestone 5)
- Updates `updated_at`
- Returns updated issue

### 2. Relations CRUD (`/api/relations/`)

**GET /api/issues/:id/relations**
- Returns two arrays: `incoming` (where this issue is target) and `outgoing` (where this issue is source)
- Each relation includes the other issue's id, title, type, image_path
- Includes `body` (the markdown explanation)
- No auth required

**POST /api/issues/:id/relations** (auth required)
```json
{ "target_id": "uuid", "relation_type": "causes", "body": "Because burning..." }
```
- `source_id` comes from URL param
- Validates both issues exist
- Validates relation_type enum
- Unique constraint violation → 409
- Returns created relation

**PATCH /api/relations/:id** (auth required)
- Update `body` only
- Returns updated relation

**DELETE /api/relations/:id** (auth required)
- Returns 204

### 3. Regions (`/api/regions/`)

**GET /api/issues/:id/regions**
- Returns array of regions for an issue
- No auth required

**POST /api/issues/:id/regions** (auth required)
```json
{ "s2_cell_id": 12345678, "region_name": "North Sea" }
```
- Manual region entry (auto-extraction from location URLs comes in milestone 6)
- Returns created region

**DELETE /api/regions/:id** (auth required)
- Returns 204

**GET /api/regions?s2_cell_id=...**
- Find all issues overlapping a given S2 cell
- Returns issue summaries
- No auth required

### 4. Comments (`/api/comments/`)

**GET /api/issues/:id/comments**
- Threaded structure: top-level comments with nested replies
- Each comment includes user info (username), score, created_at
- Sort by: created_at (default), score
- No auth required

**POST /api/issues/:id/comments** (auth required)
```json
{ "body": "This is important because...", "parent_comment_id": null }
```
- `parent_comment_id` optional — null for top-level comment
- Validates parent comment belongs to same issue if provided
- Returns created comment

### 5. Votes (`/api/votes/`)

**POST /api/votes** (auth required)
```json
{ "target_type": "issue", "target_id": "uuid", "value": 1 }
```
- Upsert: if vote exists with same value, delete it (toggle off). If different value, update. If new, insert.
- After vote change, update cached `score` on target (issues.score or comments.score)
- For `issue_version` targets, no cached score column yet — compute on read
- Returns `{ action: "created"|"updated"|"deleted", new_score }`

### 6. Graph Traversal (`/api/graph/`)

**GET /api/graph?root=<issue_id>&depth=3&direction=outgoing**
- Recursive CTE traversal of issue_relations
- `direction`: outgoing (follow source→target), incoming (follow target→source), both
- `depth`: max traversal depth (default 3, max 10)
- Returns nodes (issues) and edges (relations) as flat arrays for graph rendering
- No auth required

### 7. Router Setup (`/api/router.ts`)
Wire all routes into the Deno HTTP server. Use std/http or Oak router. Apply session middleware globally, check auth per-route where needed.

## Verification
```bash
# Create issue (with session cookie from milestone 3)
curl -X POST localhost:8000/api/issues \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"title":"Test Issue","body":"Some description","severity":3}'

# List issues
curl localhost:8000/api/issues | jq

# Get specific issue
curl localhost:8000/api/issues/<id> | jq

# Add relation
curl -X POST localhost:8000/api/issues/<id1>/relations \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"target_id":"<id2>","relation_type":"causes","body":"Because..."}'

# Vote
curl -X POST localhost:8000/api/votes \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"target_type":"issue","target_id":"<id>","value":1}'

# Graph
curl "localhost:8000/api/graph?root=<id>&depth=2" | jq
```

## Constraints
- All list endpoints support pagination (limit/offset).
- Parameterized queries only. No SQL injection vectors.
- Write endpoints require valid session. Read endpoints are public.
- Return proper HTTP status codes: 201 for create, 204 for delete, 400 for validation, 401 for unauthenticated, 404 for not found, 409 for conflicts.
- Keep handlers thin. Business logic in separate modules, handlers just parse request + call logic + format response.
- Memory-conscious: no loading full tables into memory. Always paginate or stream.
