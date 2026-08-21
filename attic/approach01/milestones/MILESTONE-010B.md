# Milestone 10B: Backup & Restore

## Goal
Provide reliable backup and restore scripts for three use cases:
1. **Disaster recovery** — full snapshot before migrations or server restarts, restorable if something goes wrong.
2. **Pre-migration safety** — automated backup before `dbmate up`, with version tracking to prevent incompatible restores.
3. **Dev seeding** — populate a fresh DB with real data during development without running the full application.

## Prerequisites
- Milestone 2 (DB migrations) complete
- PostgreSQL client tools available in dev shell (already from M1)

## Deliverables

### 1. Backup Script (`scripts/backup.ts`)

Standalone Deno script. No HTTP server required.

```bash
scripts/run.sh deno run --allow-env --allow-run --allow-read --allow-write scripts/backup.ts
```

Behavior:
1. Read `DATABASE_URL` from environment
2. Query latest applied migration version from `schema_migrations` table
3. Run `pg_dump --format=custom --file=backups/YYYY-MM-DD_HHMMSS_v<N>.dump`
4. Print backup path and size on completion

Filename format: `YYYY-MM-DD_HHMMSS_v<N>.dump` where `<N>` is zero-padded latest migration number (e.g., `v014`). Migration version is embedded in the filename for quick identification.

Creates `backups/` directory if it doesn't exist.

### 2. Restore Script (`scripts/restore.ts`)

Standalone Deno script. Two modes:

```bash
# Full restore (disaster recovery): drops and recreates DB from backup
scripts/run.sh deno run --allow-env --allow-run --allow-read scripts/restore.ts backups/2024-01-15_120000_v014.dump

# Data-only restore (dev seeding): loads data into existing schema
scripts/run.sh deno run --allow-env --allow-run --allow-read scripts/restore.ts --data-only backups/2024-01-15_120000_v014.dump
```

**Full mode (default):**
1. Parse migration version from backup filename
2. Drop and recreate the database
3. Run `pg_restore --dbname=$DATABASE_URL <file>`
4. Verify migration version matches after restore
5. Print summary (tables restored, row counts)

**Data-only mode (`--data-only`):**
1. Parse migration version from backup filename
2. Query current DB migration version; error if DB version < backup version (can't load newer data into older schema)
3. Truncate all content tables (issues, citations, relations, tags, comments, votes, regions, issue_tags, issue_regions, issue_relations, issue_citations, issue_versions) in correct dependency order
4. Run `pg_restore --data-only --dbname=$DATABASE_URL <file>`
5. Print summary

Both modes accept a backup file path as positional argument. If omitted, default to `backups/latest.dump`.

### 3. Latest Symlink Convention

After every successful backup, update `backups/latest.dump` as a copy of the new backup file. This gives dev workflows a stable path:

```bash
scripts/run.sh deno run --allow-env --allow-run --allow-read scripts/restore.ts --data-only backups/latest.dump
```

### 4. Gitignore

Add `backups/` to `.gitignore`. Backup files contain data and should never be committed.

### 5. Tests (`tests/backup_restore_test.ts`)

Integration tests against live PostgreSQL. Resource sanitizers disabled on the describe block (same pattern as other DB tests).

- **Round-trip full:** Insert test rows → backup → drop DB → restore --full → verify row counts and migration version match
- **Data-only seed:** Run migrations on fresh DB → insert test rows → backup → truncate tables → restore --data-only → verify data present and schema intact
- **Version mismatch guard:** Create backup with fake version v999 → attempt restore --data-only → verify clear error message
- **Latest symlink:** Run backup → verify `backups/latest.dump` exists and matches the timestamped file

All tests clean up created backup files in finally blocks.

## Constraints
- Scripts read `DATABASE_URL` from environment. No hardcoded credentials.
- Uses `pg_dump` / `pg_restore` from dev shell (PostgreSQL client tools already in M1 flake).
- Backups stored in `backups/` relative to repo root. Never committed.
- No cloud storage. No compression beyond pg_dump custom format's built-in compression.
- Scripts are standalone Deno programs. They do not import from `/api/` and do not require the HTTP server.
- Memory-conscious: pg_dump/pg_restore handle streaming internally. No need to load entire DB into Deno memory.
- Restore truncates in dependency order to avoid foreign key violations in data-only mode.
