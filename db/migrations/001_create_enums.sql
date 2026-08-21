-- migrate:up
CREATE TYPE issue_type AS ENUM ('draft', 'problem', 'cause', 'action');
CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'wontfix');
CREATE TYPE relation_type AS ENUM ('causes', 'parent_of', 'related_to');
CREATE TYPE citation_type AS ENUM ('video', 'article', 'news', 'location', 'other');
CREATE TYPE vote_target_type AS ENUM ('issue', 'issue_version', 'comment');

-- migrate:down
DROP TYPE IF EXISTS vote_target_type;
DROP TYPE IF EXISTS citation_type;
DROP TYPE IF EXISTS relation_type;
DROP TYPE IF EXISTS issue_status;
DROP TYPE IF EXISTS issue_type;
