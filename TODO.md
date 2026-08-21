# TODO

## Milestone 1: Flake + Dev Shell (`MILESTONE-001.md`)

- [x] Create `flake.nix` with inputs (nixpkgs stable) and `devShells.default` using `mkShell`, including: deno, pnpm, nodejs, dbmate, postgresql, libpq. Set env vars (`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`). Add `shellHook` that prints tool versions on entry.
- [x] Run `nix flake lock` to generate `flake.lock`.
- [x] Verify dev shell: enter `nix develop` and confirm all tools are available (`deno --version`, `pnpm --version`, `node --version`, `dbmate --version`, `psql --version`).

## Milestones 2–16 (not yet broken down)

- [ ] Milestone 2: DB migrations
  - [x] 2a: Create `/db/dbmate.env` configuration file
  - [x] 2b: Create migration `001_create_enums.sql`
  - [x] 2c: Create migration `002_create_users.sql`
  - [x] 2d: Create migration `003_create_sessions.sql`
  - [x] 2e: Create migration `004_create_captcha_challenges.sql`
  - [x] 2f: Create migration `005_create_citations.sql`
  - [x] 2g: Create migration `006_create_issues.sql`
  - [x] 2h: Create migration `007_create_issue_versions.sql`
  - [x] 2i: Create migration `008_create_tags.sql`
  - [x] 2j: Create migration `009_create_issue_tags.sql`
  - [x] 2k: Create migration `010_create_issue_regions.sql`
  - [x] 2l: Create migration `011_create_issue_relations.sql`
  - [x] 2m: Create migration `012_create_issue_citations.sql`
  - [x] 2n: Create migration `013_create_comments.sql`
  - [x] 2o: Create migration `014_create_votes.sql`
  - [x] 2p: Ensure PostgreSQL is running, run `dbmate up`, verify all 14 tables and 5 enums
- [ ] Milestone 3: Auth
- [ ] Milestone 4: Core API
- [ ] Milestone 5: Link extraction + citations
- [ ] Milestone 6: Location extraction
- [ ] Milestone 7: Tags + ontology
- [ ] Milestone 8: Image upload
- [ ] Milestone 9: Issue versions
- [ ] Milestone 10: Data dumps
- [ ] Milestone 11: Capture frontend
- [ ] Milestone 12: Refinery + LLM assist
- [ ] Milestone 13: Tracker frontend
- [ ] Milestone 14: Community frontend
- [ ] Milestone 15: Direct Action frontend
- [ ] Milestone 16: Seed ontology import
