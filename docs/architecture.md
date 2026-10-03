# Lingo Store Architecture

This repository implements **Lingo Store Web Architecture v2**.

## Applications

| App | Host | Stack |
|---|---|---|
| web | lingostore.example | Next.js |
| admin | admin.lingostore.example | Next.js |
| pos | pos.lingostore.example | React + Vite PWA |
| api | internal API origin | Fastify |

## Rules

- No Flutter/native client in this repository.
- No staff pages or APIs on the public host.
- No shared browser session cookie between hosts.
- Browser sessions use secure server-side cookies, not JWT/localStorage.
- Authorization is enforced server-side with deny-by-default policies.
- POS access requires a registered terminal.
- Business totals and permissions are server authoritative.
- PostgreSQL is the central source of business data.
- IndexedDB is only the POS offline cache/queue.
- Hardware-adjacent work such as printing remains client-side.

## Initial development order

1. Monorepo foundation
2. API/security baseline
3. Database and sessions
4. Public website
5. Admin
6. Business modules
7. Web POS
8. Offline/sync and hardening
