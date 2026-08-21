# Milestone 2: DB Migrations v2

## Goal
Replace all 14 approach01 migrations with a minimal set for the capture-first model.

## Prerequisites
- Milestone 1 complete (dev shell working)
- Old migrations archived to `attic/approach01/db/migrations/`

## Deliverables

### 1. Wipe old migrations
Delete all files in `db/migrations/`.

### 2. `001_create_users.sql`
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text,
  display_name text,
  about text,
  avatar_path text,
  oidc_sub text,
  oidc_issuer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. `002_create_sessions.sql`
Same as approach01:
```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
```

### 4. `003_create_captcha_challenges.sql`
Same as approach01:
```sql
CREATE TABLE captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_data jsonb NOT NULL,
  answer_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
```

### 5. `004_create_captures.sql`
All capture-related tables in one migration:
```sql
CREATE TABLE captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT '***',
  what text,
  where_text text,
  why text,
  when text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_status ON captures(status);
CREATE INDEX idx_captures_created_at ON captures(created_at DESC);

CREATE TABLE capture_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capture_urls_capture_id ON capture_urls(capture_id);

CREATE TABLE capture_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  path text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capture_images_capture_id ON capture_images(capture_id);

CREATE TABLE capture_regions (
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  s2_cell bigint NOT NULL,
  label text
);
CREATE INDEX idx_capture_regions_capture_id ON capture_regions(capture_id);
CREATE INDEX idx_capture_regions_s2_cell ON capture_regions(s2_cell);
```

## Verification
```bash
scripts/run.sh bash -c 'dbmate down && dbmate up'
scripts/run.sh psql -c '\dt'          # should show 7 tables
scripts/run.sh psql -c '\d captures'   # verify columns
```

## Constraints
- Must work on empty database (no dependencies on old data)
- No enums — use plain text for status
- All timestamps use `timestamptz`
- Foreign keys with appropriate ON DELETE behavior
