-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS citations;
