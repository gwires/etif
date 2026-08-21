# Milestone 5: Link Extraction + Citations

## Goal
When an issue is created or updated, automatically extract URLs from the markdown body, classify them, and store as citations.

## Prerequisites
- Milestone 4 complete (issues CRUD working)
- `citations` and `issue_citations` tables exist

## Deliverables

### 1. URL Extractor (`/api/citations/extract.ts`)

Parse markdown body text and extract all URLs. Use regex for markdown link patterns:
- `[text](url)` — standard markdown links
- Bare URLs: `https://...` or `http://...` not inside parentheses
- `<url>` — autolinks

Return deduplicated array of raw URL strings.

### 2. URL Classifier (`/api/citations/classify.ts`)

Classify each URL by type:

| Pattern | Type |
|---------|------|
| youtube.com/watch, youtu.be, vimeo.com, dailymotion.com | `video` |
| google.com/maps, maps.google.com, openstreetmap.org/#map=, osm.org | `location` |
| Known news domains (maintain a small hardcoded list ~30 domains: bbc.com, reuters.com, nytimes.com, theguardian.com, etc.) | `news` |
| Everything else | `article` |

Return `{ url, type }`.

### 3. Metadata Fetcher (`/api/citations/fetch_metadata.ts`)

For non-location URLs, optionally fetch page to extract metadata:
- Fetch with timeout (5s), max size (500KB), follow redirects (max 3)
- Parse HTML `<title>` tag
- Parse `<meta name="description">` or `<meta property="og:description">`
- Parse `<meta name="author">` or `<meta property="article:author">`
- Parse `<meta property="article:published_time">`
- If fetch fails, still create citation with null metadata fields
- Do NOT fetch location URLs (no useful metadata)
- Do NOT fetch video URLs (metadata extraction for video platforms is complex; just store URL)

Memory note: fetch one URL at a time, sequentially. No parallel fetching.

### 4. Citation Storage (`/api/citations/store.ts`)

For each extracted URL:
1. Check if citation with this URL already exists (upsert on unique URL constraint)
2. If exists, use existing citation id
3. If new, insert into `citations` table with classified type and fetched metadata
4. Insert into `issue_citations` (ignore conflict on duplicate)

### 5. Integration with Issues API

Modify the issue create/update handlers from milestone 4:
- After saving issue body, call extraction pipeline
- Run asynchronously but await completion before returning response (so citations are linked immediately)
- On PATCH where body changed: remove old `issue_citations` for this issue, re-extract and re-link

### 6. Citations Read Endpoint

**GET /api/issues/:id/citations**
- Returns array of citations for an issue
- Grouped by type: `{ videos: [...], articles: [...], news: [...], locations: [...] }`
- Each citation includes: id, url, type, title, author, published_at, summary
- No auth required

## Verification
```bash
# Create issue with links
curl -X POST localhost:8000/api/issues \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{
    "title": "Fossil Fuel Subsidies",
    "body": "See [this report](https://www.reuters.com/climate/report) and video https://youtube.com/watch?v=abc123\n\nAlso check https://google.com/maps/@51.5,-0.1,15z",
    "severity": 4
  }'

# Check citations were extracted
curl localhost:8000/api/issues/<id>/citations | jq
# Should show 3 citations: 1 news, 1 video, 1 location
```

## Tests
- `tests/citations_extract_test.ts` — markdown link parsing, bare URLs, autolinks, deduplication
- `tests/citations_extract_prop_test.ts` — PBT: extracted URLs are subset of source text URLs; no duplicates for any input
- `tests/citations_classify_test.ts` — type classification for video/news/location/article patterns
- `tests/citations_classify_prop_test.ts` — PBT: classification is deterministic; every URL gets exactly one type
- `tests/citations_pipeline_test.ts` — full extract→classify→store flow against DB, upsert behavior, re-extraction on update

## Constraints
- Sequential URL processing only (memory constraint).
- HTTP fetches have strict timeouts and size limits.
- Never block the response indefinitely — if metadata fetch times out, create citation without metadata.
- URL deduplication is global (same URL across different issues shares one citation row).
- Do NOT implement archiving yet — that's future work. Just populate `archive_path` as null.
- Keep the news domain list small and hardcoded. No external lookup service.
