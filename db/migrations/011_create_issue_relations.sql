-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS issue_relations;
