# Codex Final Handoff

## Objective
Finish and verify `adourix/lingo-store` against `Lingo Store Web Architecture v2.md` and leave `main` in a production-ready MVP state.

## Hard constraints
- Do not create, modify, or delete GitHub Actions workflows.
- Keep the three web surfaces isolated: public, admin, POS.
- Keep one Fastify API, one PostgreSQL database, and one authorization/business-logic engine.
- Keep browser authentication cookie-based for public/admin; POS browser/native authentication remains bearer-only.
- No browser-to-PostgreSQL access.
- No secrets, tokens, or sessions in localStorage/sessionStorage.
- Preserve append-only financial/audit protections and transactional inventory/sales/payment behavior.
- Preserve admin MFA and POS terminal enrollment/refresh-family rotation.

## Required final verification
1. Read the architecture specification completely before changing behavior.
2. Install with the repository's pinned pnpm version and frozen lockfile.
3. Run Prisma generation and validate migrations on a fresh PostgreSQL database.
4. Run typecheck, lint, format check, all workspace tests, and production builds.
5. Run API integration/security tests covering:
   - route-policy deny-by-default
   - public/admin/POS host isolation
   - Origin + Fetch Metadata checks
   - CSRF
   - admin MFA and recovery codes
   - session rotation/revocation/expiry
   - RBAC ceilings and object authorization
   - POS enrollment/login/refresh/reuse detection
   - sale idempotency
   - inventory concurrency
   - refunds/approvals
   - audit immutability
   - WebSocket origin/authentication/subscription authorization
6. Verify there are no duplicate Fastify routes and that the API starts successfully.
7. Verify strict TypeScript and remove remaining explicit `any` from application code rather than weakening the global lint rule.
8. Verify Arabic/English locale handling and RTL/LTR behavior on public/admin/POS surfaces.
9. Verify accessibility-critical states and keyboard navigation for the primary workflows.
10. Verify production environment validation and deployment/runbook documentation.
11. Do not report success unless the commands above actually pass. Record any unavoidable environment-only limitation explicitly.

## Known areas requiring final attention
- `apps/api/src/server.ts` is large and still contains explicit `any` annotations that need a safe typed refactor.
- The current API source must be checked for duplicate route registrations before runtime startup; the fetched source showed `/api/admin/reports/export` registered more than once.
- Shared validation schemas have been expanded under `packages/validation`, but endpoint-level adoption must be verified rather than assumed.
- The repository currently has no CI status attached to the recent direct commits; local/runtime verification is therefore mandatory.

## Existing work already completed
- Shared validation schemas/tests for identity, POS enrollment/refresh, sales, payments, refunds, approvals, customers, pagination, and idempotency.
- POS browser-origin isolation tests.
- Global `no-explicit-any` lint gate restored to error; remaining violations must be fixed, not hidden.
- Root test/security scripts expanded to execute workspace tests.
- Admin/public/POS surface isolation, MFA, session, RBAC, financial integrity, audit, and WebSocket hardening already exist and must be preserved while completing the remaining verification/refactor work.
