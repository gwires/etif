#!/usr/bin/env bash
# Run all tests with TAP output. Must be run inside the dev shell.
# Usage: scripts/unit-test.sh              # run all, filtered output
#        scripts/unit-test.sh --verbose     # run all, full output
#        scripts/unit-test.sh tests/db_test.ts  # run single file

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL not set. Run inside dev shell (scripts/run.sh bash)." >&2
  exit 1
fi

VERBOSE="${1:-}"
shift || true

TEST_FILES="$@"
if [ -z "$TEST_FILES" ]; then
  TEST_FILES="tests/*_test.ts tests/*_prop_test.ts"
fi

if [ "$VERBOSE" = "--verbose" ]; then
  deno test --allow-net --allow-env --allow-read --allow-write $TEST_FILES
else
  # TAP reporter gives structured pass/fail lines.
  # Filter out download/caching noise, keep only TAP protocol output.
  deno test --reporter=tap --allow-net --allow-env --allow-read --allow-write $TEST_FILES 2>&1 \
    | grep -vE '^\[0m' | grep -vE '^Download' | grep -vE '^$' || true
fi
