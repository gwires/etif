#!/usr/bin/env bash
# Start API server inside nix dev shell.
# Usage: scripts/api-dev.sh
exec nix develop --command deno run --allow-net --allow-env api/main.ts
