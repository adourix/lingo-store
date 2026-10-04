# ADR 0001: Three isolated web surfaces

## Decision

Use three separate web applications—public website, Admin, and Web POS—with one Fastify API, one PostgreSQL database, and one authorization engine.

## Rationale

Separate origins allow distinct host-only cookies, bundles, CSP policies, and network exposure. Business logic remains centralized in the API so Admin and POS cannot drift into separate business implementations.

## Consequences

- Public host cannot reach Admin or POS API namespaces through the reverse proxy.
- Admin requires mandatory MFA and a separate session cookie.
- POS requires a registered terminal and a separate session cookie.
- Database and financial invariants remain shared across all surfaces.
- Cross-surface browser authentication is intentionally not shared.
