# everything-fucked

## Dev Setup

```bash
nix develop                          # enter dev shell
scripts/postgres-initial-setup.sh    # start PostgreSQL, create user + database
dbmate up                            # run migrations
scripts/capture-dev.sh               # start Capture frontend dev server
```

## Capture Frontend

SvelteKit app for quick issue drafting and viewing recent captures. Opens at <http://localhost:5173>.

```bash
scripts/capture-dev.sh                                    # dev server
scripts/run.sh bash -c 'cd capture && pnpm build'         # build → capture/build/
scripts/run.sh bash -c 'cd capture && pnpm preview'       # preview build
scripts/run.sh bash -c 'cd capture && pnpm check'         # type check
```
