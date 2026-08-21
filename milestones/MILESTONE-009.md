# Milestone 9: Issue Versions

## Goal
Track version history of issues. When an issue is edited, create a version snapshot. Allow voting on specific versions.

## Prerequisites
- Milestone 4 complete (issues CRUD working)
- `issue_versions` table exists
- Votes table supports `issue_version` target type

## Deliverables

### 1. Version Creation (`/api/issues/versions.ts`)

**Auto-create version on issue update:**
When PATCH /api/issues/:id changes title, body, or image_path:
1. Get current max version number for this issue
2. Insert new `issue_versions` row with incremented version, snapshot of NEW values
3. Set `edited_by` from session user

**POST /api/issues/:id/versions** (auth required) — explicit version creation
```json
{ "title": "...", "body": "...", "image_path": "..." }
```
- Creates a new version without updating the current issue state
- Useful for community members proposing edits without directly modifying the issue
- Returns created version

### 2. Version History Endpoint

**GET /api/issues/:id/versions**
- Returns all versions sorted by version number descending
- Each version includes: id, version number, title, body excerpt (first 200 chars), image_path, edited_by username, created_at
- No auth required

**GET /api/issues/:id/versions/:version_id**
- Full version detail including complete body
- Includes vote score (computed from votes table where target_type = 'issue_version')
- No auth required

### 3. Version Voting

Votes already support `target_type = issue_version` in the schema. The POST /api/votes endpoint from milestone 4 handles this.

Add to **GET /api/issues/:id/versions**: include computed score per version.

### 4. Initial Version on Create

When a new issue is created via POST /api/issues:
- After inserting the issue, also insert version 1 as a snapshot
- This ensures every issue has at least one version entry

### 5. Integration Updates

Update **PATCH /api/issues/:id** handler:
- After successful update, auto-create version snapshot
- Return updated issue with new version number

Update **GET /api/issues/:id**:
- Include `current_version` number and `version_count`

## Verification
```bash
# Create issue (should auto-create version 1)
curl -X POST localhost:8000/api/issues \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"title":"Original","body":"v1 body","severity":3}'

# Update issue (should auto-create version 2)
curl -X PATCH localhost:8000/api/issues/<id> \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"body":"v2 body with improvements"}'

# List versions
curl localhost:8000/api/issues/<id>/versions | jq
# Should show version 1 and 2

# Vote on a specific version
curl -X POST localhost:8000/api/votes \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{"target_type":"issue_version","target_id":"<version-id>","value":1}'
```

## Constraints
- Versions are immutable once created. Never update a version row.
- Version numbers are monotonically increasing per issue (no gaps guaranteed, but no reuse).
- Body snapshots store full text, not diffs. Storage is cheap; diff computation is expensive.
- Memory-conscious: when listing versions, return body excerpts only. Full body on individual version GET.
- Auto-versioning on PATCH cannot be disabled. Every change is tracked.
