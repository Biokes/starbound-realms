# Database backup and restore runbook

This covers the Postgres database used by the indexer. It holds all indexed
history: claims, battles, trades and upgrades. The chain can rebuild the
current state, but not always the history, because RPC retention is limited.
So back it up.

Scripts: `scripts/backup-db.sh` and `scripts/restore-db.sh`. Dumps use
Postgres custom format, which `pg_restore` can read selectively.

## 1. Take a backup

From the repository root, with the stack running:

```bash
bash scripts/backup-db.sh
```

This writes `backups/starbound-<UTC timestamp>.dump`. The script checks the
file with `pg_restore --list` before keeping it, so a failed run leaves no
file behind. It also deletes dumps older than `BACKUP_RETENTION_DAYS`
(default 14).

To write somewhere else:

```bash
BACKUP_DIR=/var/backups/starbound bash scripts/backup-db.sh
```

## 2. Schedule it

Run the backup daily. On Linux, add this to `crontab -e`:

```cron
15 3 * * * cd /path/to/starbound-realms && bash scripts/backup-db.sh >> /var/log/starbound-backup.log 2>&1
```

Copy the dumps off the machine that holds the volume. A backup on the same
disk as the database does not protect against a volume failure.

## 3. Verify a backup (do this after any change to the backup setup)

A backup you have not restored is not yet a backup. Restore into a scratch
database, not the live one:

```bash
docker compose exec -T postgres createdb -U postgres starbound_restore_check
docker compose exec -T postgres pg_restore -U postgres -d starbound_restore_check --no-owner < backups/<file>.dump
docker compose exec -T postgres psql -U postgres -d starbound_restore_check -c "SELECT COUNT(*) FROM star_systems;"
docker compose exec -T postgres dropdb -U postgres starbound_restore_check
```

The row count should match the live database, give or take events indexed
since the backup was taken.

## 4. Restore into the live database

This replaces objects in the `starbound` database. Use it only after a
failure, or when you have decided to roll back.

```bash
bash scripts/restore-db.sh backups/<file>.dump --yes
```

The script stops the `backend` service first and starts it again afterwards.
It refuses to run without `--yes`. To restore without touching the backend,
set `RESTORE_STOP_SERVICES=` (empty).

After the restore, check the indexer cursor. If the restored dump is older
than the chain, the indexer resumes from the saved cursor and re-applies the
missing events.

## 5. Migrations

The dump records the schema it was taken from. If you restore a dump taken
before a migration, run `npm run migrate:up` in `backend/` afterwards to bring
it to the current schema.

## Troubleshooting

- `dump is empty`: the `postgres` service is not running, or the database
  name is wrong. Check `POSTGRES_DB` and `docker compose ps`.
- `did not pass pg_restore --list`: the dump is corrupt or was cut short.
  Take a new backup. Do not restore this file.
- `pg_restore: error` during restore: the output names the object that
  failed. The rest of the restore is usually fine. Re-run the restore into a
  scratch database to see the full list of errors.
