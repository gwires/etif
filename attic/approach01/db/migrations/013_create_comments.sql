-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS comments;
