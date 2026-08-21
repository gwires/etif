-- migrate:up
CREATE TABLE issue_tags (
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, tag_id)
);

-- migrate:down
DROP TABLE IF EXISTS issue_tags;
