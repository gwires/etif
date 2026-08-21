-- migrate:up
CREATE TABLE issue_citations (
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  citation_id uuid NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, citation_id)
);

-- migrate:down
DROP TABLE IF EXISTS issue_citations;
