# ADR-001: Three isolated web surfaces

## Decision
Use separate public, admin, and POS applications/hosts sharing one Fastify API and PostgreSQL database.

## Security consequences
Each surface has a separate session cookie and authorization ceiling. Admin access requires MFA. POS access requires a registered terminal and the `pos.use` permission.

## Rejected alternative
A single mixed application with one session namespace was rejected because the architecture requires isolation between customer, staff, and POS surfaces.
