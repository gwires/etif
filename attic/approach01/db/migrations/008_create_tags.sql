-- migrate:up
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  parent_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  description text
);
CREATE INDEX idx_tags_parent ON tags(parent_tag_id);

-- migrate:down
DROP TABLE IF EXISTS tags;
