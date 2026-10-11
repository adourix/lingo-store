# Lingo Store Web Architecture v2

The repository uses the project architecture specification `Lingo Store Web Architecture v2` as the source of truth.
The runtime summary below reflects the implementation currently in `main`, including explicitly documented gaps.

## Surfaces

- Public customer website: `apps/web`, Next.js, port 3000.
- Admin application: `apps/admin`, Next.js, port 3001, isolated on the admin host.
- Browser POS: `apps/pos`, currently Next.js runtime on port 3002. **This does not yet satisfy the target React + Vite static SPA/PWA architecture** and must not be deployed as though it were a static build.
- API: `apps/api`, Fastify, port 4000.
- Database: PostgreSQL, port 5432, private only.

## Host routing and security boundaries

Production traffic MUST enter through `infra/nginx/lingo-store.conf`. Public, admin, and POS hosts are separate browser origins. The proxy exposes only the API namespace for each host and keeps PostgreSQL and application ports private.

- Customer, staff, and POS sessions use separate server-side session kinds and host-only `__Host-` cookies.
- POS browser authentication is cookie-based with CSRF and Origin checks; the earlier native bearer/refresh-token implementation is not the current browser POS contract.
- Authorization is server-side and deny-by-default for API routes.
- Money is stored in integer minor units; financial and inventory history is protected by least-privilege PostgreSQL grants and reviewed migrations.
- Create operations use idempotency keys where applicable.
- Offline sale sync revalidates current server-side prices and inventory and can return `NEEDS_REVIEW`.

## Known MVP limitations

- The POS static React/Vite migration is outstanding.
- Offline discounts are not carried through the sync contract as an authoritative amount; changed prices or totals can require review.
- Cash-session accounting is foundational and should not be represented as a complete reconciliation ledger.
- CI includes unit/API checks and builds, but not full browser E2E coverage.

This file is an implementation summary only; the v2 architecture specification remains authoritative.