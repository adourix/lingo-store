# Lingo Store

Security-first web platform with three isolated applications sharing one Fastify API and PostgreSQL database:

- Public customer website: port 3000
- Admin application: port 3001
- Web POS companion: port 3002, using the same device API and encrypted IndexedDB
- POS device API: port 4000 behind `pos.lingostore.example`; Flutter remains the official POS client
- Fastify API: port 4000
- PostgreSQL: private only

The implementation follows the project source-of-truth document: Lingo Store Web Architecture v2.

## Local development

Requirements: Node.js 22+, pnpm 10.17+, PostgreSQL, Nginx, and mkcert for local TLS. PostgreSQL may run directly on the host; Docker is not required.

1. Create a local certificate for the three `.localhost` hosts with mkcert and configure Nginx with `infra/nginx/local-dev.conf`.
2. Copy `.env.local.example` to `.env`; set the database passwords and generate `MFA_ENCRYPTION_KEY` with `openssl rand -base64 32`.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Start the host PostgreSQL service and create a dedicated development database. For a new local cluster, create the restricted roles with `sudo -u postgres psql -d postgres -f infra/postgres/bootstrap-roles.sql`, then create `lingo_store` owned by `lingo_migrator`. Set passwords out of band with `psql`'s `\\password` command. Configure `DATABASE_URL` for the application role and `MIGRATOR_DATABASE_URL` for the migration role.
5. For a new database, run `pnpm db:generate` followed by `pnpm db:migrate:deploy`.
6. For an existing database that already contains the Lingo Store schema but has no `_prisma_migrations` table, do not run `migrate reset` or replay the baseline SQL. Export `MIGRATOR_DATABASE_URL` and run `bash ./scripts/db-baseline-existing.sh`. The script verifies the expected baseline tables and records only `20261001_init` as applied. Then run `pnpm db:migrate:deploy` to apply all later migrations, including runtime role-grant reconciliation.
7. Apply `infra/postgres/roles.sql` as a database administrator when provisioning a fresh database or when the documented PostgreSQL role policy needs to be restored.
8. Seed the RBAC permission registry with `pnpm db:seed`, then start the apps with `pnpm dev` and access `https://lingostore.localhost`, `https://admin.localhost`, and `https://pos.localhost` through Nginx.

### Prisma migration credentials

Application traffic must use the restricted `lingo_app` role. Prisma migrations must use `lingo_migrator`. The repository's `pnpm db:migrate:deploy` command invokes `scripts/db-migrate-deploy.sh`, which requires `MIGRATOR_DATABASE_URL` and uses it for Prisma's `DATABASE_URL` during migration execution. This prevents accidental schema changes through the runtime application role.

The bootstrap superuser is only for local database initialization and grant setup. Neither runtime application traffic nor Prisma migrations should use the bootstrap account.

The public site and Admin app are intentionally separate browser origins. The POS API uses bearer credentials and no cookies or cross-origin CORS. Never expose PostgreSQL to a browser or public network.

The web POS is an additional same-origin browser client described in [ADR 002](docs/adr/002-web-pos-companion.md); it does not replace the Flutter POS.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:db
```

Production deployment must use reviewed Prisma migrations and the least-privilege PostgreSQL roles in `infra/postgres/roles.sql`.

The initial migration is a full baseline for new databases. Existing databases must not have the baseline SQL replayed over existing tables. Use `scripts/db-baseline-existing.sh` only after confirming that the database is the intended existing Lingo Store database and that Prisma migration history is absent.

## First administrator

After the API is built:

```bash
pnpm --filter @lingo/api admin:create --email "owner@lingostore.example" --name "Owner"
```

The command prints a single-use setup URL. The invitee chooses the password and enrolls mandatory MFA.

Recovery procedures are documented in `docs/cli-recovery.md`.

## Operations

See:

- `docs/operations.md`
- `docs/architecture.md`
- `docs/terminal-hardening.md`
- `infra/nginx/lingo-store.conf`

Secrets, production credentials, and real customer data must never be committed.
