# TODO

## Milestone 1: Flake + Dev Shell (`MILESTONE-001.md`)

- [x] Create `flake.nix` with inputs (nixpkgs stable) and `devShells.default` using `mkShell`, including: deno, pnpm, nodejs, dbmate, postgresql, libpq. Set env vars (`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`). Add `shellHook` that prints tool versions on entry.
- [x] Run `nix flake lock` to generate `flake.lock`.
- [x] Verify dev shell: enter `nix develop` and confirm all tools are available (`deno --version`, `pnpm --version`, `node --version`, `dbmate --version`, `psql --version`).

## Milestones 2–16 (not yet broken down)

- [ ] Milestone 2: DB migrations
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
