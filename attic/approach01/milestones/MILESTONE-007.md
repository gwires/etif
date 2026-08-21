# Milestone 7: Tags + Ontology

## Goal
CRUD for hierarchical tags (ontology) and ability to tag issues.

## Prerequisites
- Milestone 4 complete (issues CRUD working)
- `tags` and `issue_tags` tables exist

## Deliverables

### 1. Tags CRUD (`/api/tags/`)

**GET /api/tags**
- Returns full tag tree as nested structure or flat list with parent references
- Query param: `flat=true` for flat list, default nested
- No auth required

**POST /api/tags** (auth required)
```json
{ "name": "fossil-fuels", "parent_tag_id": null, "description": "Issues related to..." }
```
- Validates name: lowercase, hyphens allowed, max 64 chars
- Validates parent_tag_id exists if provided
- Returns created tag

**PATCH /api/tags/:id** (auth required)
- Update description only (name changes could break things — disallow or handle carefully)
- Returns updated tag

**DELETE /api/tags/:id** (auth required)
- Cascades: children get `parent_tag_id = NULL` (SET NULL FK)
- Removes all `issue_tags` references via CASCADE
- Returns 204

### 2. Issue Tagging (`/api/issues/:id/tags/`)

**POST /api/issues/:id/tags** (auth required)
```json
{ "tag_id": "uuid" }
```
- Adds tag to issue
- Conflict (already tagged) → 409 or idempotent 200
- Returns the issue_tag entry

**DELETE /api/issues/:id/tags/:tag_id** (auth required)
- Removes tag from issue
- Returns 204

### 3. Tag-Based Filtering

Update **GET /api/issues** from milestone 4:
- Support `?tag=tag-name` query param (filter by tag name, not ID for UX)
- Support multiple tags: `?tag=climate&tag=energy` (AND logic — issue must have all)
- Join through `issue_tags` table

### 4. Ontology Tree Endpoint

**GET /api/tags/tree**
- Returns hierarchical tree structure:
```json
[
  {
    "id": "...", "name": "environment", "description": "...",
    "children": [
      { "id": "...", "name": "climate", "description": "...", "children": [...] },
      { "id": "...", "name": "biodiversity", "description": "...", "children": [] }
    ]
  }
]
```
- Recursive CTE or application-level assembly
- No auth required

### 5. Issues by Tag Browse Endpoint

**GET /api/tags/:name/issues**
- Returns issues tagged with this tag or any descendant tag
- Supports same pagination/sort params as GET /api/issues
- Useful for ontology browsing in frontend

## Verification
```bash
# Create tag hierarchy
curl -X POST localhost:8000/api/tags \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"name":"environment","description":"Environmental issues"}'

curl -X POST localhost:8000/api/tags \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"name":"climate","parent_tag_id":"<env-id>","description":"Climate change related"}'

# Get tree
curl localhost:8000/api/tags/tree | jq

# Tag an issue
curl -X POST localhost:8000/api/issues/<id>/tags \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"tag_id":"<climate-id>"}'

# Filter issues by tag
curl "localhost:8000/api/issues?tag=climate" | jq

# Browse tag subtree
curl "localhost:8000/api/tags/environment/issues" | jq
```

## Tests
- `tests/tags_test.ts` — CRUD, name validation, parent validation, cascade delete
- `tests/tags_tree_test.ts` — tree assembly from flat list, nesting correctness
- `tests/tags_tree_prop_test.ts` — PBT: flatten(nest(flat)) === flat; no cycles; depth ≤ max
- `tests/api_tags_filter_test.ts` — tag-based issue filtering, multi-tag AND logic, descendant tag search

## Constraints
- Tag names are unique globally.
- Max nesting depth: 10 levels (prevent infinite recursion in tree queries).
- Tree endpoint: build tree in application code, not recursive SQL (simpler, easier to debug).
- All reads public, writes require auth.
- Keep tag operations simple. No bulk operations yet.
