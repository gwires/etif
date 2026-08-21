-- migrate:up
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text,
  display_name text,
  about text,
  avatar_path text,
  oidc_sub text,
  oidc_issuer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE users;
