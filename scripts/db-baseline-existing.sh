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

if pnpm exec prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -q 'Database schema is not empty'; then
  :
fi

# Refuse to baseline a database that already has Prisma history.
if pnpm exec prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -q '_prisma_migrations'; then
  echo "Prisma migration history already exists; refusing to baseline." >&2
  exit 1
fi

# The existing database must contain the baseline's core tables. This prevents
# accidentally recording the baseline against an unrelated/empty database.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
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
