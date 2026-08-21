-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS issue_versions;
