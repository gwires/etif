-- migrate:up
CREATE TABLE issue_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  s2_cell_id bigint NOT NULL,
  region_name text
);
CREATE INDEX idx_issue_regions_s2 ON issue_regions(s2_cell_id);
CREATE INDEX idx_issue_regions_issue ON issue_regions(issue_id);

-- migrate:down
DROP TABLE IF EXISTS issue_regions;
