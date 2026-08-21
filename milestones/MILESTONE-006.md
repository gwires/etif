# Milestone 6: Location Extraction

## Goal
When a citation of type `location` is created, extract coordinates from the URL and create corresponding `issue_regions` entries with S2 cell IDs.

## Prerequisites
- Milestone 5 complete (citations pipeline working)
- `issue_regions` table exists

## Deliverables

### 1. Coordinate Extractors (`/api/regions/extract_coords.ts`)

Parse coordinates from location URLs:

**Google Maps URLs:**
- `https://www.google.com/maps/@LAT,LNG,ZOOM,/data=!3m1!1e3` → extract lat, lng
- `https://www.google.com/maps/dir/POINT1/POINT2/POINT3/POINT4` → extract all points
- `https://www.google.com/maps/place/NAME/@LAT,LNG,ZOOM` → extract lat, lng
- `https://www.google.com/maps/dir/POINT1/POINT2` → midpoint or both points
- Regex: `/@(-?\d+\.?\d*),(-?\d+\.?\d*)/`

**OpenStreetMap URLs:**
- `https://www.openstreetmap.org/#map=ZOOM/LAT/LNG` → extract lat, lng
- `https://www.openstreetmap.org/?mlat=LAT&mlon=LNG` → extract lat, lng
- Regex for hash format: `/map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/`
- Regex for query format: `/mlat=(-?\d+\.?\d*)&mlon=(-?\d+\.?\d*)/`

Return array of `{ lat, lng }` objects. Return empty array if parsing fails (don't crash).

### 2. S2 Cell Computation (`/api/regions/s2.ts`)

Convert lat/lng to S2 cell ID at an appropriate level:

Since we cannot rely on pg_s2 extension being available yet, implement basic S2 cell ID computation in TypeScript/Deno:

**Option A (preferred):** Use a minimal S2 implementation. The core algorithm:
1. Convert lat/lng to XYZ on unit sphere
2. Determine cube face
3. Project to face coordinates
4. Convert to Hilbert curve position
5. Combine face + position into 64-bit cell ID

Use level 12 (~5km cells) as default for regional issues. Allow override via config.

**Option B (fallback):** If S2 computation is too complex to implement from scratch, store raw lat/lng in a separate column and defer S2 conversion. Add `lat` and `lng` float columns to `issue_regions` as fallback:
```sql
ALTER TABLE issue_regions ADD COLUMN lat double precision;
ALTER TABLE issue_regions ADD COLUMN lng double precision;
```
Then compute S2 cell IDs later when pg_s2 is available.

Choose Option A if feasible within time/token budget. Otherwise Option B.

### 3. Region Auto-Creation (`/api/regions/create_from_citation.ts`)

After a location citation is created (in milestone 5 pipeline):
1. Extract coordinates from citation URL
2. For each coordinate pair, compute S2 cell ID
3. Insert into `issue_regions` with auto-generated region_name (reverse geocode not needed — use "Lat, Lng" format or leave null)
4. Deduplicate: don't insert if (issue_id, s2_cell_id) already exists

### 4. Integration with Citation Pipeline

Hook into the citation storage step from milestone 5:
- After storing a citation with `type = location`, call region auto-creation
- This happens during issue create/update

### 5. Region Query Endpoint Enhancement

Update **GET /api/regions?s2_cell_id=...** from milestone 4:
- Support ancestor/descendant cell queries (find issues in parent or child S2 cells)
- For now, exact match only is fine. Note hierarchical query as future enhancement.

## Verification
```bash
# Create issue with Google Maps link
curl -X POST localhost:8000/api/issues \
  -H 'Content-Type: application/json' \
  -b 'session=...' \
  -d '{
    "title": "North Sea Oil Drilling",
    "body": "Location: https://www.google.com/maps/@57.5,-1.5,8z",
    "severity": 4
  }'

# Check regions were created
curl localhost:8000/api/issues/<id>/regions | jq
# Should show region with s2_cell_id computed from 57.5, -1.5

# Query by region
curl "localhost:8000/api/regions?s2_cell_id=<computed_cell_id>" | jq
```

## Constraints
- S2 computation must be pure TypeScript, no native bindings (for portability).
- If implementing S2 from scratch, keep it minimal: only need `latLngToCellId(lat, lng, level)`. No area calculations, no polygon covering, no neighbor queries.
- Memory-conscious: process coordinates sequentially.
- Graceful degradation: if coordinate extraction fails, log warning but don't fail the issue creation.
- Default S2 level 12. Document this choice.
