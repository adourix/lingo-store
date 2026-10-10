#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${MIGRATOR_DATABASE_URL:-}" ]]; then
  echo "MIGRATOR_DATABASE_URL must be set for Prisma migrations." >&2
  exit 1
fi

export DATABASE_URL="${MIGRATOR_DATABASE_URL}"

exec pnpm exec prisma migrate deploy --schema=./prisma/schema.prisma
