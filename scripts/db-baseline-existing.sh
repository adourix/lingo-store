#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${MIGRATOR_DATABASE_URL:-}" ]]; then
  echo "MIGRATOR_DATABASE_URL must be set." >&2
  exit 1
fi

export DATABASE_URL="${MIGRATOR_DATABASE_URL}"
MIGRATION="20261001_init"

# Prisma PostgreSQL URLs may contain Prisma-only query parameters such as
# ?schema=public. psql rejects those parameters, so strip the query string
# only for the psql connection while keeping DATABASE_URL intact for Prisma.
PSQL_DATABASE_URL="${DATABASE_URL%%\?*}"

# Refuse to baseline a database that already has Prisma migration history.
HISTORY_TABLE="$(psql "$PSQL_DATABASE_URL" -Atqc "SELECT to_regclass('public.\"_prisma_migrations\"')" | tr -d '[:space:]')"
if [[ "$HISTORY_TABLE" == '"_prisma_migrations"' || "$HISTORY_TABLE" == '_prisma_migrations' ]]; then
  echo "Prisma migration history already exists; refusing to baseline." >&2
  exit 1
fi

# Refuse unrelated/empty databases. These core tables are created by the
# initial Lingo Store migration and are required by the running application.
psql "$PSQL_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('public."StaffUser"') IS NULL
     OR to_regclass('public."Product"') IS NULL
     OR to_regclass('public."Sale"') IS NULL
     OR to_regclass('public."AuditLog"') IS NULL THEN
    RAISE EXCEPTION 'Existing database does not contain the expected Lingo Store baseline tables';
  END IF;
END $$;
SQL

pnpm exec prisma migrate resolve --applied "$MIGRATION" --schema=./prisma/schema.prisma

echo "Baseline recorded: $MIGRATION"
echo "Run 'pnpm db:migrate:deploy' next to apply remaining migrations."
