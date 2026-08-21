-- migrate:up
CREATE TABLE votes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type vote_target_type NOT NULL,
  target_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, target_type, target_id)
);

-- migrate:down
DROP TABLE IF EXISTS votes;
