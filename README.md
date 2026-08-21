# everything-fucked

## Dev Setup

```bash
nix develop                          # enter dev shell
bash scripts/postgres-initial-setup.sh  # start PostgreSQL, create user + database
dbmate up                            # run migrations
scripts/capture-dev.sh               # start Capture frontend dev server
```
