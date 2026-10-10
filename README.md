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

Requirements: Node.js 22+, pnpm 10.17+, PostgreSQL, Nginx, and mkcert for local TLS.

1. Create a local certificate for the three `.localhost` hosts with mkcert and configure Nginx with `infra/nginx/local-dev.conf`.
2. Copy `.env.local.example` to `.env`; set the database passwords and generate `MFA_ENCRYPTION_KEY` with `openssl rand -base64 32`.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Start PostgreSQL with `docker compose up -d postgres`. On a new volume, the one-time `lingo_bootstrap` superuser creates the three restricted roles. Set their local connection passwords with `docker compose exec postgres psql -U lingo_bootstrap -d lingo_store -c "ALTER ROLE lingo_migrator PASSWORD 'local-password'; ALTER ROLE lingo_app PASSWORD 'local-password';"`, then run `pnpm db:generate` and `pnpm db:migrate:deploy`.
5. Apply `infra/postgres/roles.sql` with `docker compose exec -T postgres psql -U lingo_bootstrap -d lingo_store < infra/postgres/roles.sql` to grant runtime access and append-only restrictions.
6. Seed the RBAC permission registry with `pnpm db:seed`, then start the apps with `pnpm dev` and access `https://lingostore.localhost`, `https://admin.localhost`, and `https://pos.localhost` through Nginx.

The bootstrap superuser is only for local database initialization and grant setup. Neither `DATABASE_URL` nor `MIGRATOR_DATABASE_URL` uses it. Never point application runtime at the bootstrap account.

The public site and Admin app are intentionally separate browser origins. The POS API uses bearer credentials and no cookies or cross-origin CORS. Never expose PostgreSQL to a browser or public network.

The web POS is an additional same-origin browser client described in [ADR 002](docs/adr/002-web-pos-companion.md); it does not replace the Flutter POS.

## Verification

pnpm typecheck

pnpm --filter @lingo/api test

pnpm build

Production deployment must use reviewed Prisma migrations and the least-privilege PostgreSQL roles in infra/postgres/roles.sql.

The initial migration is a full baseline for new databases. For a database that
already has this schema but does not have the baseline recorded, compare it to
the baseline first, then mark `20261001_init` applied with Prisma
`migrate resolve`; do not run the baseline SQL over existing tables.

## First administrator

After the API is built:

pnpm --filter @lingo/api admin:create --email "owner@lingostore.example" --name "Owner"

The command prints a single-use setup URL. The invitee chooses the password and enrolls mandatory MFA.

Recovery procedures are documented in docs/cli-recovery.md.

## Operations

See:
- docs/operations.md
- docs/architecture.md
- docs/terminal-hardening.md
- infra/nginx/lingo-store.conf

Secrets, production credentials, and real customer data must never be committed.
