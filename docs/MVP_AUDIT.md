# MVP Audit

Last audited against `Lingo Store Web Architecture v2.md` on 2026-10-10.

## Closed in this pass

- Manager role now includes `admin.access`, while remaining restricted from `roles.manage` and `settings.manage`.
- Added a regression test for the manager permission boundary.
- Added an explicit PostgreSQL runtime smoke-test command and test coverage for required tables, roles, and critical triggers.
- Added public/admin/POS locale direction controls with persisted `lingo_locale` preference and `lang`/`dir` document attributes.
- `.github/workflows` was not changed.

## Still required before MVP acceptance

### P0 runtime verification

- Start the local PostgreSQL 17 service.
- Create an isolated temporary test database; never reset or drop the existing application database.
- Apply all Prisma migrations from zero.
- Verify migration consistency, roles, grants, triggers, and constraints.
- Run `TEST_DATABASE_URL=<temporary-db> pnpm test:db`.
- Run the complete API test suite against the verified database where applicable.
- Exercise customer checkout -> CASH order -> admin confirmation/processing/ready -> cash receipt -> completed.
- Exercise POS sale/refund/idempotency and inventory concurrency against PostgreSQL.

### P1 acceptance gaps

- Full Arabic translation and RTL visual/accessibility audit remain incomplete. The current locale control establishes direction infrastructure but does not translate every UI string.
- Full Playwright/E2E coverage for customer order, admin MFA/setup, POS enrollment/sale/refund, IDOR, CSRF and security regressions remains incomplete.
- Fastify response schemas are not yet consistently declared for every route.
- Error responses are not yet fully normalized to one contract.
- Admin back-office workflows remain incomplete for some business modules.
- WebSocket authentication/revalidation is implemented, but the required business event publishing pipeline still needs verification.
- Production CSP nonce/enforcement needs a runtime verification pass.
- Pagination/server-side filtering for large admin datasets needs completion.
- Registration/password-reset timing needs a final anti-enumeration verification.

### Dependency security

The repository currently pins Next.js 15.5.3. This is below the patched 15.5.x releases documented by Next.js security advisories. Upgrade must be performed together with the lockfile and verified with a frozen install/build before MVP acceptance.

## Definition of done

Do not mark the repository MVP-ready until the P0 database/runtime flow is actually executed and all remaining MVP-critical architecture requirements have either been implemented and verified or explicitly removed from MVP scope by an ADR.
