# Milestone 2: DB Migrations

## Goal
Create all database tables, enums, indexes, and constraints using dbmate.

## Prerequisites
- Milestone 1 complete (nix flake with dbmate + postgresql)
- PostgreSQL running locally with a created database

## Setup
```bash
createdb everything_fucked
export DATABASE_URL="postgres://user@localhost:5432/everything_fucked?sslmode=disable"
```

## Deliverables

### `/db/dbmate.env`
```
DATABASE_URL=postgres://user@localhost:5432/everything_fucked?sslmode=disable
DBMATE_MIGRATIONS_DIR=db/migrations
DBMATE_SCHEMA_FILE=db/schema.sql
DBMATE_NO_DUMP_SCHEMA=false
```

### Migration Files (in order)

#### `/db/migrations/001_create_enums.sql`
```sql
CREATE TYPE issue_type AS ENUM ('draft', 'problem', 'cause', 'action');
CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'wontfix');
CREATE TYPE relation_type AS ENUM ('causes', 'parent_of', 'related_to');
CREATE TYPE citation_type AS ENUM ('video', 'article', 'news', 'location', 'other');
CREATE TYPE vote_target_type AS ENUM ('issue', 'issue_version', 'comment');
```

#### `/db/migrations/002_create_users.sql`
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text,
  oidc_sub text,
  oidc_issuer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `/db/migrations/003_create_sessions.sql`
```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

#### `/db/migrations/004_create_captcha_challenges.sql`
```sql
CREATE TABLE captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_data jsonb NOT NULL,
  answer_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
```

#### `/db/migrations/005_create_citations.sql`
```sql
CREATE TABLE citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  type citation_type NOT NULL DEFAULT 'other',
  title text,
  author text,
  published_at timestamptz,
  summary text,
  archive_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(url)
);
```

#### `/db/migrations/006_create_issues.sql`
```sql
CREATE TABLE issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_path text,
  type issue_type NOT NULL DEFAULT 'draft',
  status issue_status NOT NULL DEFAULT 'open',
  severity smallint CHECK (severity BETWEEN 1 AND 5),
  score int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_issues_type ON issues(type);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_created_by ON issues(created_by);
CREATE INDEX idx_issues_score ON issues(score DESC);
CREATE INDEX idx_issues_created_at ON issues(created_at DESC);
```

#### `/db/migrations/007_create_issue_versions.sql`
```sql
CREATE TABLE issue_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  version int NOT NULL,
  title text NOT NULL,
  body text,
  image_path text,
  edited_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id, version)
);
CREATE INDEX idx_issue_versions_issue_id ON issue_versions(issue_id);
```

#### `/db/migrations/008_create_tags.sql`
```sql
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  parent_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  description text
);
CREATE INDEX idx_tags_parent ON tags(parent_tag_id);
```

#### `/db/migrations/009_create_issue_tags.sql`
```sql
CREATE TABLE issue_tags (
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, tag_id)
);
```

#### `/db/migrations/010_create_issue_regions.sql`
```sql
CREATE TABLE issue_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  s2_cell_id bigint NOT NULL,
  region_name text
);
CREATE INDEX idx_issue_regions_s2 ON issue_regions(s2_cell_id);
CREATE INDEX idx_issue_regions_issue ON issue_regions(issue_id);
```

#### `/db/migrations/011_create_issue_relations.sql`
```sql
CREATE TABLE issue_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  relation_type relation_type NOT NULL,
  body text,
  UNIQUE(source_id, target_id, relation_type)
);
CREATE INDEX idx_relations_source ON issue_relations(source_id);
CREATE INDEX idx_relations_target ON issue_relations(target_id);
```

#### `/db/migrations/012_create_issue_citations.sql`
```sql
CREATE TABLE issue_citations (
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  citation_id uuid NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, citation_id)
);
```

#### `/db/migrations/013_create_comments.sql`
```sql
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_issue ON comments(issue_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
```

#### `/db/migrations/014_create_votes.sql`
```sql
CREATE TABLE votes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type vote_target_type NOT NULL,
  target_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, target_type, target_id)
);
```

## Verification
```bash
cd /path/to/project
dbmate up
psql $DATABASE_URL -c "\dt"   # all 14 tables listed
psql $DATABASE_URL -c "\dT+"  # all 5 enums listed
```

## Constraints
- Each migration file must be idempotent where possible (dbmate handles this via tracking).
- Use `gen_random_uuid()` for UUID generation (PG 13+ built-in, no extension needed).
- No external extensions required yet (pg_s2 deferred — use plain bigint for s2_cell_id for now).
- All foreign keys use `ON DELETE CASCADE` except tags.parent_tag_id which uses `SET NULL`.
- Indexes on all foreign key columns and commonly queried fields.

## Notes
- The schema.sql dump is auto-generated by dbmate after running migrations. Do not edit it manually.
- If pg_s2 becomes available later, add a migration to create the extension and a GIST index on s2_cell_id. For now, btree index on bigint is sufficient.
