# Lingo Store Web Architecture v2

The repository follows the project architecture specification
`Lingo Store Web Architecture v2` as its source of truth. This summary
documents the current implementation and its known gaps.

## Surfaces

- Public customer website: `apps/web`, Next.js, port 3000.
- Admin application: `apps/admin`, Next.js, port 3001, isolated on the admin host.
- Browser POS: `apps/pos`, currently a Next.js runtime on port 3002.
  **The POS does not yet satisfy the target React + Vite static SPA/PWA
  architecture. Do not deploy it as a static build.**
- API: `apps/api`, Fastify, port 4000.
- Database: PostgreSQL, port 5432, private only.

## Host routing and security boundaries

Production traffic MUST enter through `infra/nginx/lingo-store.conf`.
Public, admin, and POS are separate browser origins. The proxy exposes only
each host's API namespace and keeps PostgreSQL and application ports private.

- Customer, staff, and POS sessions use separate server-side session kinds
  and host-only `__Host-` cookies.
- POS browser authentication uses cookies with CSRF and Origin checks.
  Native bearer/refresh-token authentication is not the current browser POS
  contract.
- API authorization is server-side and deny-by-default.
- Money uses integer minor units. Reviewed PostgreSQL grants and migrations
  protect financial and inventory history.
- Create operations use idempotency keys where applicable.
- Offline sale sync revalidates current server-side prices and inventory and
  can return `NEEDS_REVIEW`.

## Known MVP limitations

- The React + Vite static POS migration remains outstanding.
- Offline discounts are not carried through the sync contract as an
  authoritative amount; changed prices or totals can require review.
- Cash-session accounting is foundational, not a complete reconciliation
  ledger.
- CI includes unit/API checks and builds, but not full browser E2E coverage.

This is an implementation summary; the v2 architecture specification remains
authoritative.
