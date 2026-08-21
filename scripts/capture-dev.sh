#!/usr/bin/env bash
# Start Capture frontend dev server inside nix dev shell.
# Usage: scripts/capture-dev.sh
exec nix develop --command bash -c 'cd capture && pnpm dev'
