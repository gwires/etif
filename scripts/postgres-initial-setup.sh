#!/usr/bin/env bash
# Initialize and start a local PostgreSQL instance for development.
# Creates the efk user and everything_fucked database.
# Must be run inside `nix develop`.

set -euo pipefail

PGDATA="${PGDATA:-/tmp/efk-pgdata}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-efk}"
PGPASSWORD="${PGPASSWORD:-efk}"
PGDATABASE="${PGDATABASE:-everything_fucked}"

# Verify we have the required tools
for cmd in initdb pg_ctl pg_isready psql; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "error: $cmd not found. Run this script inside \`nix develop\`." >&2
    exit 1
  fi
done

# Initialize data directory if needed
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "Initializing PostgreSQL in $PGDATA ..."
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" --auth-local=trust --auth-host=md5
else
  echo "PostgreSQL data directory already initialized at $PGDATA"
fi

# Start postgres if not already running
if pg_isready -h "$PGHOST" -p "$PGPORT" &>/dev/null; then
  echo "PostgreSQL is already running on $PGHOST:$PGPORT"
else
  echo "Starting PostgreSQL ..."
  pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" -o "-k /tmp" start
  sleep 2
  if ! pg_isready -h "$PGHOST" -p "$PGPORT"; then
    echo "error: PostgreSQL failed to start. Check $PGDATA/logfile" >&2
    exit 1
  fi
  echo "PostgreSQL started on $PGHOST:$PGPORT"
fi

# Create user and database via local socket (trust auth)
echo "Creating user '$PGUSER' and database '$PGDATABASE' ..."
psql -h /tmp -U "$(whoami)" -d postgres -c "CREATE USER $PGUSER WITH PASSWORD '$PGPASSWORD';" 2>/dev/null || true
psql -h /tmp -U "$(whoami)" -d postgres -c "CREATE DATABASE $PGDATABASE OWNER $PGUSER;" 2>/dev/null || true
psql -h /tmp -U "$(whoami)" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $PGDATABASE TO $PGUSER;" 2>/dev/null || true

echo "Done. Database '$PGDATABASE' is ready."
