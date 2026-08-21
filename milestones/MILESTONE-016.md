# Milestone 16: Seed Ontology Import

## Goal
Create a markdown+YAML frontmatter format for defining seed issues, and an import script that loads them into the database.

## Prerequisites
- Milestones 4-7 complete (issues, relations, tags, citations API/tables)
- Database running with all tables

## Deliverables

### 1. Seed File Format

Each seed issue is a markdown file in `/seeds/issues/`:

```markdown
---
title: Climate Change
type: problem
severity: 5
tags: [climate, environment, existential-risk]
regions:
  - name: Global
    s2_cell_id: null  # global = no specific cell
relations:
  - target: greenhouse-gas-emissions
    type: parent_of
    body: "Climate change is primarily driven by increased greenhouse gas concentrations"
  - target: biodiversity-loss
    type: causes
    body: "Temperature changes disrupt ecosystems and habitats"
citations:
  - url: https://www.ipcc.ch/report/ar6/
    type: article
    title: "IPCC Sixth Assessment Report"
image: climate-change.jpg
---

Climate change refers to long-term shifts in temperatures and weather patterns.
Since the 1800s, human activities have been the main driver of climate change,
primarily due to burning fossil fuels like coal, oil and gas.

## Key Impacts
- Rising sea levels
- More frequent extreme weather events
- Ocean acidification
- Biodiversity loss

## Scale
Global, affecting every region differently.
```

### 2. Tag Seeds

Tag ontology defined in `/seeds/tags.yaml`:

```yaml
- name: environment
  description: "Issues affecting natural systems"
  children:
    - name: climate
      description: "Climate change and atmospheric issues"
    - name: biodiversity
      description: "Species loss and ecosystem degradation"
    - name: pollution
      description: "Contamination of air, water, soil"
- name: society
  description: "Social and political issues"
  children:
    - name: inequality
      description: "Economic and social inequality"
    - name: governance
      description: "Political system failures"
- name: economy
  description: "Economic system issues"
  children:
    - name: fossil-fuels
      description: "Fossil fuel industry and dependencies"
    - name: finance
      description: "Financial system issues"
```

### 3. Import Script (`/scripts/import_seeds.ts`)

```bash
deno run --allow-read --allow-net scripts/import_seeds.ts [--dry-run] [--clean]
```

Steps:
1. Parse `/seeds/tags.yaml` → insert tags with parent relationships
2. Scan `/seeds/issues/*.md` → parse frontmatter + body
3. For each seed file:
   a. Upsert issue by title (match on title to avoid duplicates on re-import)
   b. Attach tags (create any missing tags from seed's tag list)
   c. Create regions if specified
   d. Create citations from seed's citation list
   e. Create relations (resolve target titles to issue IDs — requires all issues imported first)
   f. Copy image from `/seeds/images/` to data directory if specified
4. Relations are created in a second pass after all issues exist
5. `--dry-run`: parse and validate without writing to DB
6. `--clean`: delete existing seed-imported records before importing (mark seed imports with a flag?)

### 4. Frontmatter Parser (`/scripts/parse_frontmatter.ts`)

Minimal YAML frontmatter parser:
- Split on `---` delimiters
- Parse YAML between delimiters (use Deno std/yaml)
- Return `{ metadata: object, body: string }`
- Validate required fields: title, type
- Validate enum values: type must be draft/problem/cause/action
- Validate relations reference existing seed files (warn if not found)

### 5. Seed Corpus

Create initial seed files covering:

**Tags (~20 top-level):**
environment, society, economy, technology, health, governance, energy, agriculture, water, waste, transport, housing, education, media, labor, justice, security, culture, infrastructure, information

**Issues (~30-50 starter issues):**
- Climate change hierarchy (5-8 issues from root to actions)
- Biodiversity loss chain (3-5 issues)
- Fossil fuel dependency (4-6 issues)
- Plastic pollution (3-4 issues)
- Wealth inequality (3-4 issues)
- Disinformation (3-4 issues)
- Water scarcity (2-3 issues)

Each with proper relations, tags, and at least one citation.

### 6. Idempotency

Import must be safely re-runnable:
- Match issues by title (or add a `seed_id` column to issues for tracking provenance)
- Upsert rather than insert
- Relation creation skips existing relations
- Tag attachment skips existing attachments
- Log what was created vs skipped

Consider adding `seed_id text NULLABLE` column to issues table:
```sql
ALTER TABLE issues ADD COLUMN seed_id text;
CREATE UNIQUE INDEX idx_issues_seed_id ON issues(seed_id) WHERE seed_id IS NOT NULL;
```
Use filename (without extension) as seed_id. This cleanly separates seed imports from user-created issues.

## Verification
```bash
# Dry run
deno run --allow-read scripts/import_seeds.ts --dry-run
# Should print what would be created without touching DB

# Actual import
deno run --allow-read --allow-net scripts/import_seeds.ts
# Check counts
psql $DATABASE_URL -c "SELECT type, count(*) FROM issues GROUP BY type;"
psql $DATABASE_URL -c "SELECT count(*) FROM tags;"
psql $DATABASE_URL -c "SELECT count(*) FROM issue_relations;"

# Re-run (idempotent)
deno run --allow-read --allow-net scripts/import_seeds.ts
# Should report all skipped, nothing duplicated
```

## Tests
- `tests/seeds_parse_test.ts` — frontmatter parsing, YAML validation, required field checks, enum validation
- `tests/seeds_import_test.ts` — idempotent import (create → re-run → no duplicates), relation resolution, tag attachment, dry-run mode

## Constraints
- Seed files are version-controlled alongside code. They are source, not data.
- Import script uses direct DB connection (not API). It's a dev/admin tool.
- YAML parsing via Deno std only. No external YAML libraries.
- Images referenced in seeds must exist in `/seeds/images/`. Missing images → warning, not error.
- Memory-conscious: process seed files sequentially, not all at once.
- Seed corpus should be curated, not exhaustive. Quality over quantity. Start small, grow organically.
- The open question from PLAN.md remains: how to merge seed ontology with community-refined content? For now, seeds create initial versions. Community edits create new versions. No special trust scoring yet.
