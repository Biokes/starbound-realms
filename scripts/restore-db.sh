#!/usr/bin/env bash
# Restores a dump produced by scripts/backup-db.sh into the indexer database (#298).
#
# DESTRUCTIVE: --clean drops and recreates the objects in the target database.
# Refuses to run without --yes. The backend is stopped during the restore so it
# does not write into a half-restored database.
#
# Usage:   bash scripts/restore-db.sh <file.dump> --yes
# Env:     POSTGRES_SERVICE        default postgres
#          POSTGRES_DB             default starbound
#          POSTGRES_USER           default postgres
#          RESTORE_STOP_SERVICES   default backend (space-separated; empty to skip)
#
# See docs/runbooks/database-backup-restore.md for the full procedure.
set -euo pipefail

FILE="${1:?usage: restore-db.sh <file.dump> --yes}"
CONFIRM="${2:-}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DB="${POSTGRES_DB:-starbound}"
DB_USER="${POSTGRES_USER:-postgres}"
STOP_SERVICES="${RESTORE_STOP_SERVICES-backend}"

if [ "$CONFIRM" != "--yes" ]; then
  echo "refusing to restore: this replaces objects in database '$DB'." >&2
  echo "re-run with --yes to confirm." >&2
  exit 1
fi

if [ ! -s "$FILE" ]; then
  echo "no such dump, or it is empty: $FILE" >&2
  exit 1
fi

# Check the archive before touching the live database.
if ! docker compose exec -T "$SERVICE" pg_restore --list < "$FILE" > /dev/null; then
  echo "restore aborted: $FILE is not a readable pg_dump custom archive" >&2
  exit 1
fi

for svc in $STOP_SERVICES; do
  docker compose stop "$svc"
done

docker compose exec -T "$SERVICE" \
  pg_restore -U "$DB_USER" -d "$DB" --clean --if-exists --no-owner < "$FILE"

for svc in $STOP_SERVICES; do
  docker compose start "$svc"
done

echo "restored $FILE into database '$DB'"
