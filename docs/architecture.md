# Lingo Store Web Architecture v2
The repository follows the v2 source-of-truth specification in the project architecture document.

Surfaces:
- Public: lingostore.example
- Admin: admin.lingostore.example
- POS: pos.lingostore.example

Runtime:
- Next.js public web :3000
- Next.js admin :3001
- React/Vite POS static preview :4173
- Fastify API :4000
- PostgreSQL :5432

Production traffic MUST enter through the reverse proxy in infra/nginx/lingo-store.conf. PostgreSQL and application ports stay private.

Security boundaries:
- Separate host-only cookies per surface.
- Admin and POS API namespaces are not exposed by the public host.
- POS sessions require a registered terminal.
- Money is represented in integer minor units.
- Create operations use idempotency keys where applicable.
- Financial records are treated as append-only at application level.

This file is an implementation summary; the project architecture v2 document remains the authoritative specification.