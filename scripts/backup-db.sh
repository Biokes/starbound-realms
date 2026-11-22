#!/usr/bin/env bash
# Dumps the indexer Postgres database to a timestamped, custom-format file (#298).
#
# Usage:   bash scripts/backup-db.sh [backup_dir]
# Env:     BACKUP_DIR              default ./backups
#          BACKUP_RETENTION_DAYS   default 14 (0 keeps everything)
#          POSTGRES_SERVICE        default postgres (docker compose service)
#          POSTGRES_DB             default starbound
#          POSTGRES_USER           default postgres
#
# The dump is written to a .partial file and renamed only after it passes
# `pg_restore --list`, so a failed run never leaves a file that looks valid.
# See docs/runbooks/database-backup-restore.md.
set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DB="${POSTGRES_DB:-starbound}"
DB_USER="${POSTGRES_USER:-postgres}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/${DB}-${STAMP}.dump"
PARTIAL="$FILE.partial"

cleanup() { rm -f "$PARTIAL"; }
trap cleanup EXIT

docker compose exec -T "$SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB" --format=custom --no-owner > "$PARTIAL"

if [ ! -s "$PARTIAL" ]; then
  echo "backup failed: dump is empty" >&2
  exit 1
fi

# Confirm the archive is readable before keeping it.
if ! docker compose exec -T "$SERVICE" pg_restore --list < "$PARTIAL" > /dev/null; then
  echo "backup failed: dump did not pass pg_restore --list" >&2
  exit 1
fi

mv "$PARTIAL" "$FILE"
trap - EXIT
echo "backup written: $FILE"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -name "${DB}-*.dump" -mtime +"$RETENTION_DAYS" -print -delete
fi
