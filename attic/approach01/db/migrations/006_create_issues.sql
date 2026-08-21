-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS issues;
