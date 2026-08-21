-- migrate:up
CREATE TABLE captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_data jsonb NOT NULL,
  answer_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- migrate:down
DROP TABLE captcha_challenges;
