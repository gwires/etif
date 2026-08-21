#!/usr/bin/env bash
# Run a command inside the nix dev shell.
# Usage: scripts/run.sh deno check api/main.ts
exec nix develop --command "$@"
