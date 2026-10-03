# Lingo Store

Lingo Store is a security-first web platform with three isolated web applications:

- Public customer website
- Admin application
- Web POS PWA

All surfaces share one Fastify API, PostgreSQL, and authorization engine, while keeping separate origins, sessions, bundles, and security boundaries.

Architecture source of truth: `docs/architecture.md`.
