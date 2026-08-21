# everything-fucked

## Dev Setup

```bash
nix develop                          # enter dev shell
scripts/postgres-initial-setup.sh    # start PostgreSQL, create user + database
dbmate up                            # run migrations
cd capture && pnpm install && cd ..  # install Capture dependencies
scripts/capture-dev.sh               # start Capture frontend dev server
scripts/api-dev.sh                   # start API server (port 8000)
```

## Capture Frontend

SvelteKit app for quick issue drafting and viewing recent captures. Opens at <http://localhost:5173>.

```bash
scripts/capture-dev.sh                                    # dev server
scripts/run.sh bash -c 'cd capture && pnpm build'         # build → capture/build/
scripts/run.sh bash -c 'cd capture && pnpm preview'       # preview build
scripts/run.sh bash -c 'cd capture && pnpm check'         # type check
```

## Data Export

Export users and issues to JSON for schema migration or backup:

```bash
scripts/run.sh deno run --allow-env --allow-net --allow-write export.ts
```

Produces `export/users.json` (id, username, created_at) and `export/issues.json` (id, title, body, created_at).
