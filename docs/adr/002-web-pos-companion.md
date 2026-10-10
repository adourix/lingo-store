# ADR 002: Keep the web POS as a companion client

## Status

Accepted.

## Decision

The Flutter application remains the official POS client described by Architecture v2. The existing `apps/pos` application is retained as an additional browser client for the same `/api/pos/*` contract. It does not add a business engine, database, identity system, or browser session to the platform.

The web client uses opaque device and cashier credentials issued by the POS API. Persistent credentials and queued sales are encrypted in IndexedDB with a non-extractable Web Crypto key. It does not use cookies for identity, localStorage, sessionStorage, or cross-origin API access. The POS API accepts browser mutation requests only when their Origin exactly matches the configured POS origin; native clients may omit Origin. Cross-site browser requests remain rejected.

## Consequences

- Flutter and web clients share server-side authorization, pricing, inventory, idempotency, and transaction rules.
- The web client can support browser-based tills where encrypted IndexedDB and the browser's printing support meet the operator's needs.
- Hardware integration and secure platform credential storage remain stronger on Flutter. This companion is not a replacement for the official client.
- Any future POS client must use the same device enrollment, token rotation, cashier permission ceiling, and offline-sync rules.
