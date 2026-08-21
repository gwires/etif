# Milestone 10: Data Dumps

## Goal
Make all data available as read-only public dumps via API endpoints and periodic archive generation.

## Prerequisites
- Milestones 4-9 complete (all core data tables populated)

## Deliverables

### 1. Dump API Endpoints (`/api/dumps/`)

All endpoints are public, no auth required. Return JSON by default. Support `?format=jsonl` for streaming.

**GET /api/dump/issues**
- Stream all issues as JSON array or JSONL
- Include: id, title, body, type, status, severity, score, created_by username, created_at, updated_at, image_path
- Exclude: nothing (all public)

**GET /api/dump/citations**
- All citations with metadata
- Include issue associations (which issues reference each citation)

**GET /api/dump/relations**
- All issue_relations with source/target titles and relation body

**GET /api/dump/tags**
- Full ontology tree or flat list
- Include issue counts per tag

**GET /api/dump/comments**
- All comments with threading info

**GET /api/dump/regions**
- All issue_regions with S2 cell IDs and associated issue titles

**Common query params:**
- `?format=json|jsonl` — output format (default: json)
- `?since=ISO_TIMESTAMP` — only records created/updated after this time (incremental dump)
- `?limit=N&offset=N` — pagination for large datasets

### 2. Streaming Response (`/api/dumps/stream.ts`)

For JSONL format, use streaming responses:
- Query DB in batches (1000 rows at a time using cursor/pagination)
- Write each row as a JSON line to the response stream
- Never load entire table into memory
- Set `Content-Type: application/jsonl` and `Transfer-Encoding: chunked`

For JSON format with `since` filter (smaller result sets):
- Load filtered results and return as JSON array
- Still paginate internally but buffer response

### 3. Archive Generation Script (`/scripts/generate_dump.ts`)

Deno script that generates a full timestamped archive:

```bash
deno run --allow-net --allow-write scripts/generate_dump.ts
```

Steps:
1. Connect to PostgreSQL directly (using DATABASE_URL)
2. For each table, query all rows and write to temp JSON files
3. Run `pg_dump --data-only` for SQL format
4. Create tar.gz archive: `/dumps/YYYY-MM-DD.tar.gz` containing:
   - `issues.json`
   - `citations.json`
   - `relations.json`
   - `tags.json`
   - `comments.json`
   - `regions.json`
   - `full.sql` (pg_dump output)
5. Clean up temp files

Create `/dumps/` directory if it doesn't exist.

### 4. Dump Index Endpoint

**GET /api/dumps**
- List available archive files with dates and sizes
- Returns: `[{ filename: "2024-01-15.tar.gz", size_bytes: 1234567, created_at: "..." }]`
- Reads from `/dumps/` directory listing
- No auth required

### 5. Static File Serving for Archives

**GET /dumps/:filename**
- Serve archive files from `/dumps/` directory
- Content-Type: application/gzip
- No auth required

## Verification
```bash
# JSON dump
curl localhost:8000/api/dump/issues | jq '.[0]'

# JSONL streaming
curl localhost:8000/api/dump/citations?format=jsonl | head -5

# Incremental
curl "localhost:8000/api/dump/issues?since=2024-01-01T00:00:00Z" | jq

# Generate archive
deno run --allow-net --allow-write scripts/generate_dump.ts
ls -la dumps/

# List archives
curl localhost:8000/api/dumps | jq

# Download archive
curl -o dump.tar.gz localhost:8000/dumps/2024-01-15.tar.gz
```

## Tests
- `tests/dumps_test.ts` — JSON dump completeness, JSONL streaming format, incremental since-filter, pagination

## Constraints
- Streaming is mandatory for JSONL format. Never buffer entire table.
- Batch size for streaming: 1000 rows. Adjust if memory pressure observed.
- Archive generation runs as a separate script, not inside the HTTP server.
- Archives stored on local filesystem. No cloud storage.
- Dump endpoints have no rate limiting (public data), but implement basic request counting for monitoring.
- pg_dump requires PostgreSQL client tools — already in dev shell from milestone 1.
- Memory-conscious: the entire point of JSONL streaming is to avoid loading everything at once.
