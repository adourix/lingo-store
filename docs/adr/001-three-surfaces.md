# ADR-001: Three isolated web surfaces

## Decision

Use separate public and admin browser applications plus a POS device API host, sharing one Fastify API and PostgreSQL database.

## Security consequences

Public and Admin have separate host-only cookies and authorization ceilings. Admin access requires MFA. POS uses an enrolled device, opaque bearer tokens, and the `pos.use` permission.

## Rejected alternative

A single mixed application with one session namespace was rejected because the architecture requires isolation between customer, staff, and POS surfaces.
