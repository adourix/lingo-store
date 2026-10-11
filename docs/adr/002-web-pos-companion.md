# ADR 002: Web POS is the official POS client

## Status

Accepted.

## Decision

Lingo Store is web-only. The React POS in `apps/pos` is the official POS client for shop terminals and implements the business behavior previously represented by the Flutter POS. No native or Flutter client is part of the platform scope.

The POS client is a browser application using the `/api/pos/*` contract. It does not contain a business engine, database, or independent identity system. Authentication and authorization remain server-side: registered terminal enrollment qualifies a browser, cashier login creates a server-side POS session, and every request is checked against the POS permission ceiling.

The browser keeps only local POS concerns such as the offline queue and catalog cache in IndexedDB. Authentication remains in HttpOnly cookies; credentials, access tokens, and session state are not stored in localStorage or sessionStorage. Browser mutations require CSRF protection and an Origin policy that accepts only the configured POS origin.

## Consequences

- The web POS is the single supported POS client and must remain aligned with the POS behavior defined by Architecture v2.
- Public, admin, and POS applications remain separate origins with separate session kinds and API namespaces.
- Server-side authorization, pricing, inventory, idempotency, and transaction rules are shared across all clients.
- Hardware integration is limited to browser capabilities such as printing and scanning; managed shop terminals should use a hardened kiosk browser profile.
- Any future native client would require an explicit architecture revision; it is not part of the current platform.
