# ADR 0001: Three isolated web surfaces

## Decision

Use a public website, an isolated Admin application, and a native POS device API with one Fastify API, one PostgreSQL database, and one authorization engine.

## Rationale

Separate origins allow distinct host-only cookies, bundles, CSP policies, and network exposure. Business logic remains centralized in the API so Admin and POS cannot drift into separate business implementations.

## Consequences

- Public host cannot reach Admin or POS API namespaces through the reverse proxy.
- Admin requires mandatory MFA and a separate session cookie.
- POS requires an enrolled device plus opaque bearer access tokens and rotating refresh tokens. It has no browser session cookie or hosted web client.
- Database and financial invariants remain shared across all surfaces.
- Cross-surface browser authentication is intentionally not shared.
