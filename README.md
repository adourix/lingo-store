# Lingo Store

Security-first web platform with three isolated applications sharing one Fastify API and PostgreSQL database:

- Public customer website: port 3000
- Admin application: port 3001
- Web POS PWA: port 5173 in development, static build in production
- Fastify API: port 4000
- PostgreSQL: private only

The implementation follows the project source-of-truth document: Lingo Store Web Architecture v2.

## Local development

Requirements: Node.js 22+, pnpm 10.17+, PostgreSQL.

1. Copy .env.example to .env and set local values.
2. Install dependencies: pnpm install
3. Generate Prisma client: pnpm db:generate
4. Apply local schema/migrations as appropriate.
5. Seed RBAC: pnpm db:seed
6. Start all apps: pnpm dev

The public site, Admin app, and POS are intentionally separate origins. Never expose PostgreSQL to the browser or public network.

## Verification

pnpm typecheck

pnpm --filter @lingo/api test

pnpm build

Production deployment must use reviewed Prisma migrations and the least-privilege PostgreSQL roles in infra/postgres/roles.sql.

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
