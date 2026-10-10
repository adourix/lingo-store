# Implementation Verification Status

This file records the verification state of the current checkout. It is not a
completion declaration. The architecture source of truth remains
`Lingo Store Web Architecture v2.md`.

## Verified in this checkout

- Frozen workspace install completed in the previous verified checkout.
- Formatting, workspace lint, workspace typecheck, API tests, and production
  builds passed in the previous verified checkout.
- Prisma schema validation and client generation passed using a non-routable
  placeholder datasource URL; those commands did not connect to a database.
- API source scan found no explicit `any`, `@ts-ignore`, `@ts-expect-error`, or
  `as any` bypasses in the previous verified checkout.
- Route-policy tests scan literal Fastify registrations for duplicates and
  require policy registration. The source scan found no duplicate literal
  routes.
- Static migration review found ordered baseline and follow-up migrations,
  UTC timestamp conversions, append-only financial/audit protections, and
  least-privilege grants.
- Manager RBAC now includes `admin.access` while remaining restricted from
  `roles.manage` and `settings.manage`.
- A PostgreSQL smoke-test command and runtime smoke test now exist under
  `pnpm test:db` / `apps/api/src/tests/database-smoke.test.ts`.
- Public, admin, and POS surfaces now have locale direction infrastructure via
  the `lingo_locale` cookie and `lang`/`dir` document attributes. This is not
  a claim that all UI strings have been translated.
- No files under `.github/workflows` were changed during this work.

## Not verified / remaining work

- PostgreSQL 17 runtime verification is still outstanding. The installed
  cluster previously reported `down` on port 5432. No application database
  should be reset or modified for this verification; use a separate temporary
  database.
- The temporary-database migration lifecycle, runtime role/grant/trigger
  inspection, and database-backed tests remain unverified.
- The customer checkout -> CASH order -> admin lifecycle -> cash receipt ->
  completed flow has not yet been exercised end-to-end against PostgreSQL.
- POS sale/refund/idempotency and inventory-concurrency behavior have not yet
  been exercised against PostgreSQL.
- Full Arabic translation and complete RTL visual/accessibility behavior are
  not implemented across all pages. Only locale/direction infrastructure has
  been added.
- The test suite still lacks full real-database integration coverage for
  authentication/session rotation, MFA recovery, object-level RBAC,
  concurrent sales/refunds, idempotent replay, inventory races, audit trigger
  immutability, and WebSocket revocation.
- Full Playwright/E2E coverage and the complete architecture acceptance audit
  remain outstanding.
- Fastify response schemas are not yet consistently declared for every route,
  and error response shapes are not yet fully normalized.
- Some admin business workflows remain generic/incomplete compared with the
  architecture's full back-office requirements.
- WebSocket authentication/revalidation is implemented, but business event
  publishing still needs runtime verification.
- Production CSP nonce/enforcement requires a runtime verification pass.
- The repository currently uses Next.js 15.5.3. This must be upgraded to a
  currently patched 15.5.x release (or a supported newer major) together with
  the lockfile, followed by a frozen install and production build.

Do not describe the repository as production-ready or MVP-verified until the
remaining MVP-critical items have been implemented and actually verified
against the architecture specification.
