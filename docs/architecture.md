# Lingo Store Web Architecture v2
The repository follows the project architecture specification
`Lingo Store Web Architecture v2` as its source of truth.
This summary documents the current implementation and its known gaps.
`Lingo Store Web Architecture v2` as the source of truth.
The runtime summary below reflects the implementation currently in `main`,
including explicitly documented gaps.

- Admin application: `apps/admin`, Next.js, port 3001.
  It is isolated on the admin host.

  **This does not yet satisfy the target React + Vite static
  SPA/PWA architecture. Do not deploy it as a static build.**
- Admin application: `apps/admin`, Next.js, port 3001, isolated on the admin host.
- Browser POS: `apps/pos`, currently Next.js runtime on port 3002.
  **This does not yet satisfy the target React + Vite static SPA/PWA architecture**
  and must not be deployed as though it were a static build.
- API: `apps/api`, Fastify, port 4000.
- Database: PostgreSQL, port 5432, private only.

Production traffic MUST enter through `infra/nginx/lingo-store.conf`.
Public, admin, and POS are separate browser origins. The proxy exposes
only each host's API namespace and keeps PostgreSQL/application ports private.

- Customer, staff, and POS sessions are separate and use host-only
  `__Host-` cookies.
- POS browser authentication uses cookies with CSRF and Origin checks;
  native bearer/refresh-token auth is not the current browser POS contract.
- Customer, staff, and POS sessions use separate server-side session kinds and host-only `__Host-` cookies.
- Money uses integer minor units. PostgreSQL grants and reviewed
  migrations protect financial and inventory history.
- Authorization is server-side and deny-by-default for API routes.
- Money is stored in integer minor units; financial and inventory history is protected by least-privilege PostgreSQL grants and reviewed migrations.
- Create operations use idempotency keys where applicable.
- Offline sale sync revalidates current server-side prices and inventory and can return `NEEDS_REVIEW`.

## Known MVP limitations

- The POS static React/Vite migration is outstanding.
This is an implementation summary; the v2 architecture
specification remains authoritative.
- Cash-session accounting is foundational and should not be represented as a complete reconciliation ledger.
- CI includes unit/API checks and builds, but not full browser E2E coverage.

This file is an implementation summary only; the v2 architecture
specification remains authoritative.