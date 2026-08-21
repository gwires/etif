-- migrate:up
CREATE TABLE captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT '***',
  what_text text,
  where_text text,
  why_text text,
  when_text text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_status ON captures(status);
CREATE INDEX idx_captures_created_at ON captures(created_at DESC);

CREATE TABLE capture_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capture_urls_capture_id ON capture_urls(capture_id);

CREATE TABLE capture_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  path text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capture_images_capture_id ON capture_images(capture_id);

CREATE TABLE capture_regions (
  capture_id uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  s2_cell bigint NOT NULL,
  label text
);
CREATE INDEX idx_capture_regions_capture_id ON capture_regions(capture_id);
CREATE INDEX idx_capture_regions_s2_cell ON capture_regions(s2_cell);

-- migrate:down
DROP TABLE IF EXISTS capture_regions;
DROP TABLE IF EXISTS capture_images;
DROP TABLE IF EXISTS capture_urls;
DROP TABLE IF EXISTS captures;
