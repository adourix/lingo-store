# Lingo Store — Web Architecture Specification (v2)
## Public Website + Isolated Admin Application + POS Device API

> **Status:** Security-hardened revision. Supersedes v1.
> **Security target:** OWASP ASVS Level 2 for the whole platform; admin and POS-device flows should meet the Level 3 controls that are practical.
> **Conventions:** **MUST** / **MUST NOT** are requirements. **SHOULD** is a strong default. Numeric limits are starting values, to be tuned.

---

# 1. Architecture Decision

Lingo Store uses **one API codebase and one PostgreSQL database**, but exposes **three isolated access surfaces**, each on its own hostname:

```text
                         LINGO STORE
                              |
      +-----------------------+-----------------------+
      |                       |                       |
      v                       v                       v
 PUBLIC WEBSITE          ADMIN APPLICATION        POS DEVICE API
 lingostore.example      admin.lingostore.example pos.lingostore.example
 (customers)             (staff, browser)         (Flutter POS, non-browser)
      |                       |                       |
      +-----------------------+-----------------------+
                              |
                    REVERSE PROXY (TLS)
          per-host allow-list of API prefixes
                              |
                              v
                        FASTIFY API
                              |
                 +------------+------------+
                 v            v            v
            PostgreSQL    WebSocket       Jobs
```

## 1.1 Why separate hostnames (and not just `/admin`)

| Problem with same-origin `/admin` | Solution in v2 |
|---|---|
| An XSS bug anywhere on the public site (contact form, product text, profile fields) runs in the same origin as the admin app and can act as the admin, even with HttpOnly cookies | Admin is a different origin. Public-site JavaScript cannot read or call admin pages with credentials |
| One cookie jar for customers and staff | Host-only cookies (`__Host-` prefix) are never sent to the other host |
| Admin code ships in the public bundle | Admin is a **separate Next.js app** (`apps/admin`) and its code is never served to the public |
| Admin API reachable from the public internet surface | Reverse proxy exposes `/api/admin/*` **only** on the admin host; the public host cannot reach it at all |
| Can't add network-level protection for admin only | Admin host can sit behind VPN / Zero Trust / IP allow-list without affecting customers |

The hostname split is a security boundary. The `/admin` path is **not** a security mechanism and is not relied on as one.

## 1.2 What is shared

- One API codebase (Fastify), one database, one business-logic layer, one RBAC engine.
- Shared packages: types, validation schemas, UI primitives.

## 1.3 What is NOT shared

- Cookies, sessions, login endpoints, CSP, layouts, navigation, frontend bundles.
- Identity tables (see §5): customers and staff are different principals.

## 1.4 Reverse-proxy routing (authoritative)

Each host forwards **only** its own prefixes. Everything else returns `404` at the proxy.

```text
lingostore.example
  /                 -> apps/web (Next.js, public)
  /api/public/*     -> API  (catalog, services, contact)
  /api/auth/*       -> API  (customer auth)
  /api/account/*    -> API  (customer account; customer session required)

admin.lingostore.example
  /                 -> apps/admin (Next.js, admin)
  /api/admin/*      -> API  (staff auth + management APIs)
  /ws/admin         -> API  (WebSocket, cookie session)

pos.lingostore.example
  /api/pos/*        -> API  (device enrollment, cashier auth, sync, operations)
  /ws/pos           -> API  (WebSocket, device bearer token)
```

The proxy MUST also:
- Strip any inbound `x-middleware-subrequest` header (Next.js middleware-bypass class of bugs).
- Set the real client IP header itself, and the API MUST only trust proxy-supplied forwarding headers (`trustProxy` restricted to the proxy's address).
- Enforce request size limits, timeouts, and a coarse per-IP rate limit before the API sees traffic.

## 1.5 Local development

Use `admin.localhost` / `pos.localhost` with a local TLS proxy so the production cookie rules (`Secure`, `__Host-`) are exercised in development. If the prefix must be relaxed locally, do it via config that is **hard-failed in production**.

---

# 2. Security Principles

1. **Server is the only security boundary.** Frontend guards are UX, never protection.
2. **Deny by default.** A route with no declared access policy MUST fail at startup (see §9.1).
3. **Separate principals.** Customers, staff, and POS devices are different identity types with different credentials, sessions, and namespaces.
4. **Least privilege** everywhere: permissions, DB roles, containers, tokens.
5. **Never trust the client** for identity, role, price, total, timestamp, or ownership.
6. **Defense in depth.** Assume any single layer (CSP, input validation, a permission check) can fail.
7. **Everything sensitive is auditable**, including denied attempts.
8. **Financial records are append-only.** Corrections are new records, not edits.

---

# 3. Threat Summary

| Threat | Primary mitigations |
|---|---|
| XSS leading to admin takeover | Separate admin origin, nonce-based CSP, output encoding, no `dangerouslySetInnerHTML` with user data, HttpOnly cookies |
| Credential stuffing / brute force | Argon2id, per-account + per-IP rate limits, progressive delay, breached-password check, mandatory staff MFA |
| Stolen / phished staff password | Mandatory MFA (WebAuthn preferred), step-up auth for sensitive actions |
| Session theft / fixation | `__Host-` HttpOnly cookies, hashed session IDs, rotation, short admin timeouts, instant revocation |
| CSRF | SameSite + Origin/Fetch-Metadata check + CSRF token |
| IDOR / broken object-level auth | Ownership scoping from session (never from request), UUIDs, 404 on foreign objects |
| Privilege escalation inside admin | Cannot grant what you don't hold, self-role-edit blocked, last-admin protection, step-up |
| Public customer reaching admin | Separate identity tables, separate host, separate cookie, `admin.access` gate |
| Tampered prices / totals from POS | Server recomputes all money; client totals are never trusted |
| Duplicate sales from offline sync | Idempotency keys + unique constraints |
| Stolen POS device | Device enrollment, short-lived tokens, refresh rotation with reuse detection, remote revoke, encrypted local DB |
| Insider fraud (refunds, voids, discounts, stock adjustments) | Granular permissions, reasons, approval thresholds, append-only audit, variance reports |
| Data exfiltration via export | `reports.export` permission, step-up, rate limit, audit, CSV-injection neutralization |
| Supply chain / secrets leakage | Lockfiles, dependency + image scanning, secret scanning, secrets outside repo |
| Tampered audit trail | Append-only DB grants + triggers, optional hash chain, off-box log shipping |

---

# 4. Entry Points and Routes

## 4.1 Public website — `https://lingostore.example`

```text
/
├── /                       home
├── /products               catalog
│   └── /products/:slug
├── /services
├── /about
├── /contact
│
├── /login
├── /register
├── /forgot-password
├── /reset-password
├── /verify-email
│
└── /account                customer session required
    ├── /account/profile
    ├── /account/orders
    └── /account/security
```

There is **no** `/admin` on this host. Requests for it return `404`. The public site never links to the admin host.

## 4.2 Admin application — `https://admin.lingostore.example`

Paths live at the root of the admin host (no `/admin` prefix needed):

```text
/login                      staff credentials
/mfa                        second factor (and MFA enrollment on first login)
/dashboard
├── /users
├── /roles                  roles & permissions
├── /products
├── /categories
├── /inventory
├── /sales
├── /purchases
├── /customers              business customers (ledger)
├── /suppliers
├── /payments
├── /expenses
├── /cash-sessions
├── /devices                POS device enrollment & revocation
├── /reports
├── /audit
├── /sessions               active sessions (own; all with permission)
├── /settings
└── /account/security       own password, MFA, recovery codes
```

Admin hosts serve `X-Robots-Tag: noindex, nofollow`. Do **not** list admin paths in any `robots.txt` (that advertises them).

## 4.3 POS device API — `https://pos.lingostore.example`

Non-browser clients only (Flutter POS). Bearer-token auth, no cookies, no CORS.

```text
POST /api/pos/auth/enroll        one-time enrollment code -> device credential
POST /api/pos/auth/login         cashier login on an enrolled device
POST /api/pos/auth/refresh       rotating refresh token
POST /api/pos/auth/logout
...  /api/pos/*                  catalog sync, sales, cash sessions, etc.
```

> **POS in the admin UI:** the POS is the Flutter client. The admin application manages devices and cash sessions but does not embed a POS screen. A web POS could later be built on the same `/api/pos/*` API.

---

# 5. Identity Model

Customers and staff are **different tables and different principals**.

```text
customer_accounts   website customers: email, password hash, verified flag.
                    NO role column. Authorization = "owns the object".

staff_users         admin / manager / cashier / custom roles.
                    Has roles -> permissions. MFA mandatory.

devices             enrolled POS devices (see §16).
```

Consequences:
- `/register` creates a `customer_accounts` row. There is no role field, so privilege assignment through registration or profile update is structurally impossible (also reject unknown request fields; see §13).
- `/login` (public) queries **only** `customer_accounts`. It cannot produce a staff session.
- Staff login (admin host) queries **only** `staff_users`.
- A website customer may optionally be linked to a business `customers` ledger record (for credit, purchase history). That link is data, not authority.

The `user` role from v1 is removed; customers don't hold roles.

---

# 6. Sessions and Cookies

## 6.1 Session model

Server-side sessions stored in PostgreSQL (Redis can replace this later without API changes).

```text
sessions
  id_hash            SHA-256 of the 256-bit random session token (token itself is never stored)
  principal_type     'customer' | 'staff'
  principal_id
  state              'pending_mfa' | 'active'          (staff only uses pending_mfa)
  created_at
  last_seen_at
  idle_expires_at
  absolute_expires_at
  mfa_verified_at    (staff)
  step_up_until      (staff; short-lived re-auth window)
  ip, user_agent     (informational; for review UI, not authorization)
  revoked_at
```

- Session tokens: ≥ 256 bits from a CSPRNG.
- Sessions never carry roles or permissions. Permissions are resolved **server-side per request** (cached briefly with invalidation on change), so permission changes and account disabling take effect immediately.
- Each session is bound to its principal type; a `customer` session is rejected by every staff endpoint and vice versa.

## 6.2 Lifetimes

| Session | Idle timeout | Absolute timeout |
|---|---|---|
| Staff (admin host) | 20 min | 8 h |
| `pending_mfa` | 5 min | 5 min |
| Customer | 7 days | 30 days |

## 6.3 Cookies

| | Public host | Admin host |
|---|---|---|
| Name | `__Host-lingo_sid` | `__Host-lingo_admin_sid` |
| Flags | `HttpOnly; Secure; Path=/` (no `Domain`) | same |
| SameSite | `Lax` | `Strict` |

- The `__Host-` prefix forces host-only, `Secure`, `Path=/`, and prevents a sibling subdomain from overwriting the cookie ("cookie tossing").
- `SameSite` does **not** separate subdomains of the same registrable domain (they are same-site). Therefore SameSite alone is not CSRF protection here; see §14.1.
- `SameSite=Strict` on admin means arriving from an external link starts logged-out. This is acceptable for admin.
- No tokens in `localStorage` / `sessionStorage`. Ever.

## 6.4 Rotation and revocation

- New session ID on: login, MFA completion, step-up, privilege change.
- Logout deletes the session server-side.
- Password change or reset **revokes all other sessions** for that principal.
- Disabling a staff account revokes all sessions **and** closes their WebSockets immediately.
- Staff can view/revoke their own sessions; `sessions.revoke` allows revoking others'.

---

# 7. Staff Authentication (Admin)

```text
Staff
  |
  v
admin host /login
  |
  v
POST /api/admin/auth/login          username/email + password
  |   - uniform error, constant-time (dummy hash when user not found)
  |   - rate limited, progressive delay
  v
Password OK -> session state = pending_mfa  (5 min, no admin API access)
  |
  v
POST /api/admin/auth/mfa            WebAuthn (preferred) or TOTP, or recovery code
  |
  v
Verify staff is active AND holds `admin.access`
  |
  v
Rotate session ID, state = active
  |
  v
/dashboard
```

## 7.1 Requirements

- **MFA is mandatory** for every staff account that holds `admin.access`. Enrollment is forced on first login. No "skip".
- **WebAuthn / passkeys** preferred; **TOTP** supported. TOTP codes are single-use (store last accepted time-step to block replay). TOTP secrets are encrypted at rest (AES-256-GCM, key from secret manager/environment, not in the DB).
- **Recovery codes:** 10 single-use codes, shown once, stored hashed.
- **Resetting someone's MFA** requires another administrator with step-up, and is audited. A password reset **never** disables MFA.
- **Password hashing: Argon2id** (at least m=19 MiB, t=2, p=1; tune to ≈250–500 ms on production hardware). Rehash transparently on login when parameters change.
- **Password policy (staff):** minimum 14 characters, no composition rules, max ≥ 128, allow paste/password managers, reject known-breached passwords (k-anonymity API or offline list) and passwords containing the account name/email.
- **First administrator and all other staff accounts** are provisioned as described in §7.3: no default credentials, and no password is ever chosen, seen, or known by anyone but its owner.
- **Step-up (re-authentication) within the last 5 minutes** is required for: changing roles/permissions, creating/disabling staff, resetting MFA, revoking devices, changing settings, exporting reports, and refunds/adjustments above configured thresholds.
- Password reset for staff: email token (see §8.3) **plus** MFA at the next login; optionally admin-initiated only.

## 7.2 Login throttling (starting values)

| Endpoint | Limit |
|---|---|
| Admin login | 5 failures / 15 min per account; 20 / 15 min per IP |
| Admin MFA verify | 5 / 5 min per session |
| Customer login | 10 failures / 15 min per account; 50 / 15 min per IP |
| Register | 5 / hour per IP |
| Forgot-password | 3 / hour per email; 10 / hour per IP |
| Contact form | 5 / hour per IP (+ CAPTCHA) |
| Public API default | 120 / min per IP |
| Admin API default | 300 / min per session |
| Report export | 5 / hour per user |

- Prefer **progressive delay** over hard lockout (hard lockout becomes a denial-of-service lever against the admin account). Admins can manually unlock.
- Alert on: ≥ 10 failures on one account, login from a new IP/device for staff, and any success after a burst of failures.
- Use a shared rate-limit store (Postgres/Redis) once more than one API instance runs.

## 7.3 Staff Provisioning (how admins and staff are added)

There is **no public sign-up for staff** and no HTTP endpoint that creates the first admin. Accounts come into existence in exactly two ways.

### A) First administrator — CLI on the server

```bash
docker compose exec api node dist/cli.js admin:create \
  --email owner@lingostore.example --name "Owner Name"
```

Behavior:

1. **Refuses to run if any active admin already exists.** (It works again only if no active admin remains, e.g. total lockout.)
2. Creates a `staff_users` row with the `admin` role, **no password**, status `pending_setup`.
3. Prints a **one-time setup link** (valid 15 minutes, single use, token stored hashed) pointing to `admin.lingostore.example/setup/<token>`.
4. The new admin opens the link, **chooses their own password** (staff policy, §7.1) and **enrolls MFA** (WebAuthn/TOTP + recovery codes). Only then does the account become `active`.
5. The action is audited with actor `cli:<os-user>`.

Rules:
- No `ADMIN_PASSWORD` environment variable, no password as a CLI argument (they leak via shell history, process lists, and CI logs).
- The CLI runs only inside the server/container; having shell access to the server is the trust anchor.
- The setup link is never emailed in plaintext logs and never reused; an expired link requires re-running the command (or `admin:issue-setup-link`, below).

### B) Every other staff member — invitation from the Admin UI

Users → **Invite staff**. Requires `users.create` **and** `users.assign_role`, plus **step-up** (§7.1).

```text
Inviter (permissions + step-up)
  |  email, name, role(s)
  v
POST /api/admin/users/invitations
  - roles must be ones the inviter is allowed to grant (§9.4: cannot grant what you don't hold)
  - creates `staff_invitations` row (token hashed, single use, expires in 48 h)
  - emails the link to the invitee ONLY (the inviter never sees the token)
  |
  v
Invitee opens admin.lingostore.example/setup/<token>
  - chooses own password, enrolls MFA
  - account becomes `active` only after MFA enrollment completes
  |
  v
Audit: staff.invited, staff.invitation_accepted
```

- Pending invitations can be listed, **resent** (invalidates the old token), and **revoked** by holders of `users.create`.
- An expired or revoked link is rejected with a generic message.
- Invited accounts cannot log in, and hold no permissions, until setup completes.
- Cashiers who only use the POS get no `admin.access`; they are invited the same way but set up a POS password/PIN and are enrolled on a device (§16).

### C) Emergency recovery — CLI on the server

```bash
node dist/cli.js admin:issue-setup-link --email owner@lingostore.example   # lost password + locked out
node dist/cli.js admin:reset-mfa        --email owner@lingostore.example   # lost MFA device and recovery codes
```

- Run only on the server; both are audited as `cli:<os-user>`.
- Each command **revokes all existing sessions** for that account and forces fresh enrollment/setup; `admin:reset-mfa` never disables MFA, it only requires re-enrolling it.
- A security alert is raised whenever either command runs.
- For day-to-day cases (not total lockout), another admin uses the UI action `users.reset_mfa` with step-up instead of the CLI.

### Offboarding

Disable (never delete) the staff account: all sessions revoked, WebSockets closed, devices they enrolled reviewed, history preserved for audit.

---

# 8. Customer Authentication

```text
Customer -> /login -> POST /api/auth/login -> customer session -> /account
```

## 8.1 Rules

- Argon2id (same hashing as staff). Minimum password length 10, breached-password check.
- Email verification required before orders/profile changes that matter.
- Login, register, and forgot-password responses are **identical** whether or not the email exists (no account enumeration), including response timing.
- Changing email or password requires current password; email change confirms to both old and new addresses.
- Optional TOTP for customers later.

## 8.2 Registration

`POST /api/auth/register` accepts a strict allow-list of fields (`email`, `password`, `name`, …). Unknown fields are rejected. There is no way to submit a role.

## 8.3 Reset and verification tokens

- 256-bit random token, stored **hashed**, single-use, expires in 30 minutes (reset) / 24 hours (verification).
- Requesting a new token invalidates previous ones.
- Using a reset token revokes all sessions.
- Tokens are never logged and never placed in URLs that third-party resources can see (set `Referrer-Policy: no-referrer` on those pages).

---

# 9. Authorization

Authentication answers *who*; authorization answers *may they do this to this object*.

## 9.1 Deny-by-default policy registry

Every route MUST declare an access policy in its route config, for example:

```text
{ auth: 'public' }
{ auth: 'customer' }
{ auth: 'staff', permission: 'products.update' }
{ auth: 'device', permission: 'pos.use' }
```

A Fastify `onRoute` hook throws at startup if a route has no declared policy. A CI test enumerates all routes and fails if any lacks one. This makes "forgot to protect the endpoint" a build failure.

## 9.2 Layers (all server-side)

```text
Request
  |
  v
1. Rate limit / request-id
  |
  v
2. Authentication            -> none/invalid: 401
  |
  v
3. Principal-type match      -> wrong type (e.g. customer on staff API): 401
  |
  v
4. Admin gate                -> staff must hold `admin.access` and be active: 403
  |
  v
5. Permission check          -> missing permission: 403 (+ audit "denied")
  |
  v
6. Object / scope check      -> not owner or out of scope: 404 (customer) / 403 (staff)
  |
  v
7. Input validation (strict schema)       -> 400
  |
  v
8. Business logic + DB transaction
  |
  v
9. Audit record
```

Example, `GET /api/admin/users`:

```text
Admin (users.view)        -> 200
Manager (if granted)      -> 200
Cashier                   -> 403
Customer cookie           -> not even sent to admin host; no session -> 401
Unauthenticated           -> 401
```

## 9.3 Object-level authorization (IDOR prevention)

- Customer endpoints: every query is scoped by `customer_account_id` **taken from the session**, never from a path/body/query parameter. `GET /api/account/orders/:id` returns `404` if the order isn't theirs.
- IDs are UUIDs (v7 preferred), never sequential integers, on every externally visible resource.
- Staff scope examples: a cashier sees only their own cash session and sales unless granted `sales.view_all`.
- Add an automated "IDOR test" per resource: user A requests user B's object → must be 404/403.

## 9.4 Privilege-escalation rules

- A staff member MUST NOT grant a permission or role they do not themselves hold.
- A staff member MUST NOT edit their own roles or permissions.
- Only holders of `users.assign_role` may assign roles; only holders of `roles.manage` (admin) may change role→permission mappings. Both require step-up and are audited.
- Users of equal or higher rank than the actor cannot be modified by non-admins.
- **Last-admin protection:** the system MUST refuse to disable, delete, or demote the last active admin (enforced in a DB transaction, not only in the UI).
- Public/self-service endpoints can never change `role`, `permissions`, `is_active`, `email_verified`, or any server-controlled field.

---

# 10. Role and Permission Model

Do not authorize on role names; authorize on permissions. Roles are named bundles of permissions.

## 10.1 Initial staff roles

```text
admin      all permissions
manager    business management; no role/permission administration, no system settings unless granted
cashier    POS operations only; no admin.access by default
```

(Customers have no roles. See §5.)

## 10.2 Permissions

```text
admin.access                 may use the admin application at all

dashboard.view

pos.use
cash_session.open
cash_session.close
cash_session.override        close/reopen with variance

products.view
products.view_cost           see purchase/cost prices and margins
products.create
products.update
products.delete              archive (soft-delete)

categories.manage

inventory.view
inventory.adjust

sales.view                   own sales
sales.view_all
sales.create
sales.discount               apply discounts (limits in settings)
sales.void
sales.refund

purchases.view
purchases.create

customers.view
customers.manage

suppliers.view
suppliers.manage

payments.view
payments.create

expenses.view
expenses.create

reports.view
reports.view_profit
reports.export

users.view
users.create
users.update
users.disable
users.assign_role
users.reset_mfa

roles.manage

devices.manage               enroll / revoke POS devices
sessions.revoke              revoke other principals' sessions

audit.view
settings.manage
```

## 10.3 Rules

- The admin sidebar and dashboard widgets are filtered by permission **for UX only**; every widget's data endpoint enforces the same permission (e.g. profit figures need `reports.view_profit`).
- Cost price and margins are hidden unless `products.view_cost`.
- Sensitive operations have configurable thresholds in settings (e.g. refunds/discounts above X require a manager permission or approval).

---

# 11. Admin Route Guard and Frontend

- The **real** check is in the API and in the admin app's server-rendered layout: before any admin page renders, the server calls `GET /api/admin/auth/me` and confirms an `active` staff session with `admin.access`. The dashboard never renders on client-side assumptions.
- Next.js middleware, if used, is only an optimistic redirect for UX. It MUST NOT be the only authorization check (there have been middleware-bypass vulnerabilities, e.g. CVE-2025-29927). Keep Next.js on a current patched version and strip `x-middleware-subrequest` at the proxy.
- Pages for unauthenticated users redirect to `/login`. Authenticated users lacking `admin.access` get a **403 page**, not a redirect loop.
- The admin app calls only same-origin `/api/admin/*`. No CORS is configured for credentialed cross-origin requests; there are no cross-origin callers.

---

# 12. API Namespaces

```text
Public host
  /api/public/*       unauthenticated catalog, services, contact (cache-friendly, DTO-restricted)
  /api/auth/*         customer register / login / logout / verify / reset
  /api/account/*      customer profile, orders

Admin host
  /api/admin/auth/*   staff login, MFA, logout, me
  /api/admin/dashboard/*
  /api/admin/users/*  roles/*  products/*  categories/*  inventory/*
  /api/admin/sales/*  purchases/*  customers/*  suppliers/*  payments/*  expenses/*
  /api/admin/cash-sessions/*  devices/*  sessions/*
  /api/admin/reports/*  audit/*  settings/*

POS host
  /api/pos/auth/*     enroll, login, refresh, logout
  /api/pos/*          sync and operations
```

- Public responses use **explicit response schemas** (DTOs). They never include `cost_price`, `supplier_id`, internal stock details, or audit fields. Fastify response schemas strip undeclared properties.
- Admin and public product representations are **different DTOs**, even though they read the same table.
- Authenticated and admin responses send `Cache-Control: no-store`.

---

# 13. Input, Output, Files

## 13.1 Validation

- Every route validates **params, query, headers (where relevant), and body** with a strict schema (shared `packages/validation`, e.g. Zod/TypeBox). Unknown fields are **rejected** (prevents mass assignment).
- Enforce body size limits (default 1 MB; larger only on specific upload routes), request timeouts, and pagination caps (e.g. max 100 per page).
- Sort and filter fields come from a whitelist; never pass user-provided field names to the ORM.
- Prisma only; no string-built SQL. Do not use `$queryRawUnsafe`; use parameterized tagged `$queryRaw` when raw SQL is unavoidable.

## 13.2 Output encoding / XSS

- Render user-provided text as text. Never use `dangerouslySetInnerHTML` with user data. If rich text is ever required, sanitize with a strict allow-list on the server.
- Contact-form messages, customer names, product descriptions, and notes are untrusted data everywhere they appear, **especially inside the admin UI**.
- Strip CR/LF from anything placed in email headers.

## 13.3 File uploads (product images)

- Allow-list JPEG / PNG / WebP; verify by content (magic bytes), not extension or `Content-Type`.
- Size cap (e.g. 5 MB), re-encode images (strips metadata and embedded payloads), random server-generated filenames.
- Store outside the application directory (object storage or a non-executable path), serve with `X-Content-Type-Options: nosniff`.
- No SVG uploads unless sanitized.

## 13.4 Exports (CSV/Excel)

- Require `reports.export`, step-up, rate limit, and audit every export.
- Neutralize spreadsheet formula injection: any cell beginning with `=`, `+`, `-`, `@`, tab, or CR is prefixed with `'`.

## 13.5 Contact form

- Rate limit + CAPTCHA (Turnstile/hCaptcha), length limits, store as plain text, display escaped.

---

# 14. Browser-Side Security

## 14.1 CSRF

All cookie-authenticated state-changing requests (`POST/PUT/PATCH/DELETE`) MUST pass **all** of:

1. `SameSite` cookie (Lax public / Strict admin).
2. **Origin check:** `Origin` (or `Referer`) must equal the host's own origin; also check `Sec-Fetch-Site` where present (`same-origin`).
3. **CSRF token** (synchronizer or signed double-submit) sent in a custom header; JSON-only `Content-Type` required.

Because subdomains are same-site, steps 2–3 are mandatory, not optional. Never perform state changes on `GET`.
Keep DNS clean: no dangling records (subdomain-takeover prevention).

## 14.2 Content Security Policy

Admin (nonce-based, strict):

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<per-request>' 'strict-dynamic';
  style-src 'self' 'nonce-<per-request>';
  img-src 'self' data: https://<image-host>;
  connect-src 'self' wss://admin.lingostore.example;
  object-src 'none';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

Public site uses an equally strict policy, adjusted only for what it truly needs (analytics, payment provider frames, etc.). Use report-only mode first, then enforce.

## 14.3 Other headers (all hosts)

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains   (add `preload` only after verifying all subdomains)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin      (admin & auth pages: no-referrer)
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

## 14.4 CORS

No wildcard origins. Public catalog endpoints need none (same-origin). Admin and POS expose no browser-facing CORS at all.

---

# 15. Business and Financial Integrity

These rules protect the store's money and stock, not just the login.

- **Money:** stored as integer minor units (e.g. piastres) with a currency code; never floating point. Quantities that can be fractional use `NUMERIC(12,3)`.
- **Server computes everything:** prices, discounts, tax, and totals are derived on the server from database state. Client-supplied totals are ignored (or rejected on mismatch).
- **Transactions:** creating a sale writes the sale, items, payments, and inventory movements in **one DB transaction**. Stock changes are atomic and race-safe.
- **Inventory ledger:** `inventory_movements` is the source of truth (append-only); stock-on-hand is derived or a verified cache. A setting controls whether stock may go negative.
- **Immutability:** sales, payments, refunds, inventory movements, and audit logs are never updated or deleted. Corrections are new reversing records. Catalog items are archived, not deleted.
- **Idempotency:** every create operation from POS/payment flows carries a client-generated UUID (`Idempotency-Key` / `client_sale_id`) enforced by a unique constraint (`device_id`, `client_id`). Retried or re-synced requests never create duplicates.
- **Refunds:** need `sales.refund`, a reason, and step-up. Refund amount ≤ remaining refundable amount of the original sale; double refunds are impossible. Amounts above the threshold require manager approval.
- **Discounts/voids:** permissioned, limited by configured maximums, always with a reason.
- **Cash sessions:** one open session per cashier/device; closing records counted cash and logs the variance.
- **Concurrency:** mutable entities (products, settings, prices) carry a `version` field for optimistic locking; stale updates return `409`.
- **Time:** store UTC (`timestamptz`). Business timezone is a setting used for "today"/report boundaries. For offline POS events, store both client time and server receive time; client time is informational only.
- **Payments data:** never store card numbers (PAN) or CVV. Online payments use a provider's hosted checkout; the database keeps only method, amount, reference, and provider token/ID.

---

# 16. POS Integration and Device Security

The server owns business data. The POS owns hardware (printer, cash drawer). No printer logic on the server.

## 16.1 Device enrollment

```text
Admin (devices.manage + step-up)
  -> generates a one-time enrollment code (expires in 15 min, single use)
POS
  -> POST /api/pos/auth/enroll { code, device info }
  -> server creates `devices` row, returns device credential
```

- Devices can be listed, renamed, and **revoked** from the admin app. Revocation kills all tokens immediately and disconnects its WebSocket.

## 16.2 Cashier login and tokens

- Cashier logs in on an enrolled device with username + password (a short PIN may be allowed **only** on an enrolled device, strictly rate-limited, with per-account/per-device lockout).
- Server issues an **opaque** short-lived access token (≈15 min) and a **rotating refresh token**; both stored hashed server-side, bound to `device_id`, with an audience that is valid **only** on `/api/pos/*`. POS tokens are rejected by admin and public APIs and vice versa.
- **Refresh-token reuse detection:** reuse of an already-rotated token revokes the entire token family and flags the device.
- Tokens live in platform secure storage (Android Keystore / iOS Keychain, e.g. `flutter_secure_storage`).
- TLS only; certificate pinning is an optional later hardening.

## 16.3 Local data and offline

- The POS's local database (sales queue, cached catalog, any customer data) is **encrypted** (e.g. SQLCipher), with the key held in secure storage. It stores no passwords.
- Offline sales are queued with idempotency keys and synced in order.
- Sales are append-only, so there are no sale "conflicts". If sync causes negative stock, the sale is **accepted and flagged for review** (the goods already left the shop); it is not rejected.
- The server revalidates synced sales (prices, permissions at time of sale, device status) and flags anomalies.
- On revocation, the POS wipes local data on next contact; offline retention is capped.

## 16.4 Scope of cashier permissions

Cashier tokens carry only the cashier's own permissions (e.g. `pos.use`, `sales.create`, `cash_session.*`); they cannot call management endpoints.

---

# 17. Real-Time Updates (WebSocket)

Endpoints: `/ws/admin` (cookie session) and `/ws/pos` (device bearer token).

Requirements:

- **Authenticate during the upgrade.** Reject unauthenticated or wrong-type upgrades.
- **Cookie-authenticated sockets MUST validate `Origin`** against the admin origin (prevents cross-site WebSocket hijacking).
- Bearer tokens are **not** sent in URL query strings (they get logged). Use a header, or authenticate in the first message within a short deadline.
- **Server-assigned subscriptions:** the client does not choose channels. The server subscribes each connection to events permitted by its permissions (e.g. `sales.view` → `sale.*`), so a user never receives events they couldn't fetch via the API.
- Payloads are minimal (IDs + essential summary); clients refetch details via the authorized API.
- Close sockets immediately on session revocation/expiry, account disable, device revoke, or permission loss; re-validate the session periodically (e.g. every 5 min).
- Max message size (e.g. 64 KB), per-connection message rate limit, connection limits per principal, heartbeat/ping timeouts.

Events:

```text
sale.created        sale.refunded        sale.voided
inventory.updated   product.updated      payment.created
cash_session.opened cash_session.closed  user.updated
device.revoked
```

---

# 18. Audit Logging and Monitoring

## 18.1 What is logged

```text
Authentication : login success/failure, MFA success/failure, lockout/throttle, logout,
                 password change/reset, MFA enroll/reset, session revoke
Authorization  : every 403 on admin/POS APIs (denied attempts)
Administration : user created/updated/disabled, staff invited/accepted/revoked,
                 CLI admin actions (admin:create, setup-link, MFA reset),
                 role/permission changes, device enroll/revoke,
                 settings updated
Business       : product created/updated/archived, price changes, inventory adjusted,
                 sale discount/void/refund, cash session open/close/variance, payments,
                 expenses, report exports
```

## 18.2 Record fields

```text
audit_logs
  id, occurred_at (UTC)
  actor_type, actor_id, actor_role_snapshot
  action, entity_type, entity_id
  outcome            success | denied | failed
  ip, user_agent, request_id, session_ref (non-reversible)
  changes            before/after diff (redacted)
  metadata           JSON
```

## 18.3 Integrity

- **Append-only:** the application DB role has `INSERT`/`SELECT` only on `audit_logs`; a trigger rejects `UPDATE`/`DELETE`.
- Ship logs to an off-box store (separate host/service) so a compromised app server can't erase history. Optional hash chain (`prev_hash`) for tamper evidence.
- Define retention (suggested ≥ 12 months online) and who may read it (`audit.view`).

## 18.4 Never log

Passwords, tokens, session IDs, MFA secrets, recovery codes, full request bodies, or card data. Use a central redaction list. Keep **application logs** (debug/ops) separate from **audit logs** (accountability).

## 18.5 Alerts

Repeated failed admin logins, staff login from a new IP/device, admin account created or MFA reset, role/permission changes, bulk export, refund spikes, large cash-session variance, device refresh-token reuse.

---

# 19. Database and Data Protection

## 19.1 Core entities

```text
Identity & access
  customer_accounts
  staff_users
  roles, permissions, role_permissions, staff_user_roles
  sessions
  mfa_credentials, recovery_codes
  password_reset_tokens, email_verification_tokens
  staff_invitations (hashed single-use setup/invite tokens)
  devices, device_enrollments, device_sessions (refresh-token families)

Catalog & stock
  products, categories
  inventory_movements

Business parties
  customers, customer_payments          (business ledger)
  suppliers, supplier_payments

Transactions
  sales, sale_items, refunds
  purchases, purchase_items
  payments
  cash_sessions
  expenses

System
  audit_logs
  settings
  contact_messages
  idempotency_keys
```

## 19.2 Conventions

- UUID primary keys; `created_at` / `updated_at` as `timestamptz`; `version` on mutable entities.
- Money = integer minor units; foreign keys and `CHECK` constraints enforce invariants (non-negative amounts, refund ≤ original, one open cash session, etc.).
- Financial tables are append-only (see §15). Catalog uses `archived_at`.
- Do **not** copy the Flutter local database schema blindly; map business behavior, not table layout.
- DDL features Prisma can't express (triggers, grants, partial unique indexes) live in reviewed raw-SQL migrations.

## 19.3 Database access

- Three DB roles: `lingo_app` (DML only on needed tables), `lingo_migrator` (DDL; used only during deploys), `lingo_readonly` (reporting). **No superuser** in application connections.
- PostgreSQL is not exposed to the internet or to the browser; it is reachable only on the private container/network.
- Encrypt backups, store them off-site, and **test restores** on a schedule.
- Encrypt disk/volumes at rest. Sensitive columns (TOTP secrets) use application-level encryption.

## 19.4 Personal data

- Collect only what's needed; define retention; support customer data export/deletion where required. Review obligations under the applicable personal-data protection law for where the store operates.
- Mask PII in logs and non-production data; never copy production data into dev unmasked.

---

# 20. Infrastructure and Delivery

## 20.1 Runtime

- Reverse proxy (Caddy / Nginx / Traefik) terminates TLS (TLS 1.2+, modern ciphers), redirects HTTP→HTTPS, applies per-host routing (§1.4). Only ports 80/443 are public; SSH is key-only and restricted (VPN/allow-list).
- **Admin host** SHOULD sit behind a VPN / Zero Trust access layer (WireGuard, Cloudflare Access, or IP allow-list). The **POS host** stays reachable by shop devices and relies on device auth.
- Containers: non-root user, read-only filesystem where possible, dropped capabilities, resource limits, no published DB port, pinned image versions/digests.
- Keep OS and images patched (unattended security updates, scheduled image rebuilds).

## 20.2 Secrets

- Secrets are never in the repo, images, or logs. Use Docker secrets / environment injected at deploy / SOPS or a secrets manager.
- Separate secrets per environment; documented rotation for DB credentials, MFA encryption key, and any provider keys.

## 20.3 CI/CD

- Lockfiles + `npm ci`; dependency updates via Renovate/Dependabot; `npm audit` and image scanning (e.g. Trivy) in CI.
- Secret scanning (e.g. gitleaks) and SAST (CodeQL/Semgrep) on every PR.
- Protected main branch, required reviews, signed/immutable build artifacts where practical.
- Security tests run in CI: route policy coverage, role×route authorization matrix, IDOR tests, CSRF tests, rate-limit tests.

## 20.4 Monitoring

Centralized structured logs with request IDs, uptime and error-rate alerts, certificate expiry alerts, backup-success alerts, and the security alerts in §18.5.

---

# 21. Error Handling

Consistent JSON errors across all APIs; no stack traces, SQL errors, or internal paths to clients.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "01J..."
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`details` lists field paths, not raw input) |
| 401 | Not authenticated / wrong principal type |
| 403 | Authenticated but not permitted |
| 404 | Not found (also used for objects the customer doesn't own) |
| 409 | Version conflict / idempotency conflict |
| 429 | Rate limited (`Retry-After` header) |
| 5xx | Generic message; details only in server logs |

Page behavior:

```text
Public : 401 -> /login   403 -> Access denied   404 -> Not found
Admin  : 401 -> /login (admin host)   403 -> Admin access denied page   404 -> Not found
```

---

# 22. Admin UI and Dashboard

## 22.1 Layouts

```text
Public layout : Header, Navigation, Main Content, Footer
Admin layout  : Sidebar, Header, Breadcrumbs, Main Content, Notifications, User Menu
```

Separate apps, separate bundles; only low-level UI primitives are shared (`packages/ui`).

## 22.2 Admin modules

```text
Dashboard, Sales, Products, Inventory, Purchases, Customers, Suppliers,
Payments, Expenses, Cash Sessions, Devices, Reports, Users & Roles,
Audit Logs, Sessions/Security, Settings
```

The sidebar shows only modules the current staff member may use (UX only; enforced server-side).

## 22.3 Dashboard widgets (each permission-gated server-side)

- Today's sales, revenue, number of invoices
- Profit (`reports.view_profit`)
- Low-stock products, top-selling products
- Recent sales, recent activity
- Open cash sessions

Aggregations run on the server; date ranges are configurable and use the business timezone.

## 22.4 Design System and UI Quality

The product must look and behave like a deliberately designed system, not a template.

**Identity and tokens**
- Define the brand first: one primary color, a neutral scale, semantic colors (success/warning/danger/info), at most two typefaces, a spacing scale, radius and shadow scales, and a type scale.
- These live as **design tokens** in `packages/ui` (CSS variables + Tailwind theme). Components never hard-code colors or spacing. Library defaults (e.g. stock shadcn/Tailwind look) are customized to the brand, not shipped as-is.
- One icon set (e.g. Lucide) with fixed sizes and stroke width. No emoji as UI icons.
- Avoid generic decoration: no gratuitous gradients, glass cards, or stock hero copy. Use real product photography, real copy, and real data in seeds and demos; no lorem ipsum or fake metrics.

**State coverage (every screen and data view)**
- Loading (skeletons, not spinners everywhere), empty (with a useful next action), error (with retry and request ID), and **permission-denied** states. A screen without all four is not done.
- Optimistic updates only where safe; destructive actions (delete/archive/refund/void/revoke) use explicit confirmation; critical ones require typing the target name or step-up.

**Admin ergonomics (back-office, not marketing)**
- Dense, scannable tables: server-side pagination, sorting, filtering, column visibility, saved filters, sticky headers.
- Keyboard-first where it matters (search focus, row navigation, common shortcuts), bulk actions with confirmation, and inline validation that never discards entered data.
- Consistent form patterns, consistent date/number/currency formatting (EGP by default; configurable), and timezone-correct dates.

**Localization and accessibility**
- Arabic and English from day one if the audience needs it: RTL layout via logical CSS properties (`margin-inline-start`, etc.), locale-aware numbers/dates, and externalized strings (no hard-coded text in components).
- WCAG 2.2 AA baseline: contrast, visible focus, labels for every input, keyboard operability, ARIA only where semantic HTML isn't enough.
- Responsive from phone to wide desktop; the public site is mobile-first.

**Performance**
- Public pages target good Core Web Vitals (LCP < 2.5 s on mid-range mobile): optimized images, route-level code splitting, no unnecessary client JavaScript on content pages.

**Content**
- Real microcopy: clear, consistent, and specific error and empty-state messages. Security errors stay generic where required (§8, §21), everything else is helpful.

---

# 23. Code Structure

## 23.1 Backend

```text
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── customer-auth
│   │   ├── staff-auth        (password + MFA + sessions)
│   │   └── device-auth       (enrollment, cashier login, refresh rotation)
│   ├── rbac/                 (roles, permissions, policy engine)
│   ├── users/                (staff management)
│   ├── customers/  suppliers/  products/  inventory/
│   ├── sales/  purchases/  payments/  expenses/  cash-sessions/
│   ├── devices/
│   ├── reports/  audit/  dashboard/  contact/
├── plugins/
│   ├── security-headers  request-id  rate-limit  csrf
│   ├── session  device-token  policy-registry  error-handler  audit
├── database/
├── websocket/
├── cli/                      (admin:create, admin:issue-setup-link, admin:reset-mfa)
└── server.ts
```

Suggested libraries: `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, an Argon2id binding (e.g. `argon2`), `otplib` (TOTP), `@simplewebauthn/server` (WebAuthn), Zod/TypeBox for schemas, Prisma.

## 23.2 Monorepo

```text
lingo-store/
├── apps/
│   ├── web/        public Next.js site (customer auth + account)
│   ├── admin/      admin Next.js app (separate bundle, separate host)
│   ├── api/        Fastify API
│   └── pos/        existing Flutter POS (own app until integration)
├── packages/
│   ├── types/
│   ├── validation/
│   ├── ui/         shared low-level components only
│   └── config/     lint / tsconfig / security-header presets
├── prisma/
│   ├── schema.prisma
│   └── migrations/ (incl. raw SQL for triggers, grants, constraints)
├── docker/
└── docs/
```

## 23.3 Engineering Standards

**Language and static checks**
- TypeScript with `strict` enabled across all packages; no `any` (use `unknown` + validation), no non-null assertion shortcuts, no `@ts-ignore` without a linked reason.
- ESLint (including security and import-boundary rules) and Prettier enforced via pre-commit (husky + lint-staged) **and** CI. A failing lint, typecheck, or test blocks merge.
- Apps may import from `packages/*`; `apps/web` and `apps/admin` must **not** import from each other (enforced by lint rule).

**Code hygiene**
- Small modules with a single responsibility; business logic in services, not in route handlers or React components.
- No dead code, commented-out blocks, or stray `console.log`; use the structured logger with the redaction list (§18.4).
- Configuration is validated at startup (schema); the app refuses to boot with missing or insecure production settings (e.g. non-`Secure` cookies, missing keys).
- Minimal dependencies; each new dependency is justified, pinned, and scanned.

**Testing**
- Unit tests for money calculations, RBAC/policy decisions, and token/session logic.
- Integration tests against a **real PostgreSQL** (e.g. Testcontainers), including constraints, triggers, and append-only rules.
- End-to-end tests (e.g. Playwright) for critical flows: customer login/order view, staff login + MFA, invite/setup, sale, refund.
- Security regression suite from §20.3 (route policy coverage, role × route matrix, IDOR, CSRF, rate limits).
- Coverage targets are strict on `auth`, `rbac`, and money modules; elsewhere meaningful tests over a vanity percentage.

**Process and documentation**
- Conventional Commits, small PRs, required review, protected main branch.
- `README` with real setup steps (one command to run locally), and `docs/` with architecture decision records (ADRs) for non-obvious choices, an operations runbook (deploy, backup/restore, key rotation, incident response), and the CLI recovery procedures from §7.3.
- Seed scripts create realistic demo data (products, sales, staff with different roles) for development and demos.
- Every change that touches auth, permissions, or money requires a test and a reviewer who did not write it.

---

# 24. Development Phases

## Phase 0 — Security Baseline
- Repo, CI (lint, tests, dependency/secret/SAST/image scanning)
- Environments, secrets handling, local TLS with `admin.localhost` / `pos.localhost`
- Reverse-proxy per-host routing, security headers, CSP in report-only
- Engineering standards enforced from commit one (§23.3); brand + design tokens in `packages/ui` (§22.4)

## Phase 1 — Foundation
- Fastify API, PostgreSQL, Prisma, DB roles
- Policy registry (deny-by-default), error format, request IDs, rate limiting
- Session system, CSRF, audit skeleton (append-only)

## Phase 2 — Public Website
- Home, Products, Services, About, Contact (CAPTCHA)
- Customer auth (Argon2id, verification, reset), account area (ownership-scoped)

## Phase 3 — Admin
- Admin app, `/login` + mandatory MFA, step-up, sessions management
- Staff users, roles, permissions, escalation rules, last-admin protection
- Staff provisioning (§7.3): first-admin CLI bootstrap, invitation flow, emergency CLI recovery

## Phase 4 — Business Modules
- Products, categories, inventory ledger, customers, suppliers
- Sales, purchases, payments, expenses, cash sessions (money rules from §15)

## Phase 5 — Reports & Audit
- Reports, analytics, permission-gated widgets
- Audit viewer, alerts, safe exports (CSV-injection protection)

## Phase 6 — POS Integration
- Device enrollment, cashier auth, token rotation + reuse detection
- Product, customer, sales, and inventory sync with idempotency

## Phase 7 — Real-Time & Offline
- Authenticated, permission-scoped WebSockets
- Offline POS with encrypted local DB, sync queue, anomaly flagging

## Phase 8 — Hardening & Launch
- Authorization matrix, IDOR, CSRF, and rate-limit test suites green
- External or structured self penetration test (e.g. OWASP ZAP + manual)
- Backup **restore drill**, monitoring and alert verification
- Enforce CSP; enable HSTS preload only after verification
- Complete the checklist in §26

---

# 25. Must-Nots

- No separate business logic or database for admin.
- No admin pages/APIs on the public host. No shared session cookie between hosts.
- No tokens in `localStorage` / `sessionStorage`; no JWTs for browser sessions.
- No direct browser-to-PostgreSQL access; no database exposed to the internet.
- No authorization implemented only in the frontend or only in Next.js middleware.
- No role/permission/`is_active` fields accepted from public or self-service requests.
- No plaintext or reversibly-encrypted passwords; no default or shared credentials.
- No client-trusted prices, totals, timestamps, or ownership IDs.
- No updates or deletes on financial or audit records.
- No card numbers or CVV stored.
- No secrets in the repository, images, or logs.
- No printer/hardware logic on the server.
- No blind copy of the Flutter database schema.

---

# 26. Security Acceptance Checklist (pre-launch)

**Identity & sessions**
- [ ] Customers and staff are in separate tables; public login cannot produce a staff session
- [ ] `__Host-` HttpOnly Secure cookies, separate names per host; session IDs stored hashed
- [ ] Staff MFA enforced with no bypass; recovery codes hashed; MFA reset requires another admin + step-up
- [ ] Idle/absolute timeouts as specified; rotation on login/MFA/step-up; revoke-all on password change
- [ ] Argon2id in use; breached-password check active; login/reset responses non-enumerating
- [ ] `admin:create` refuses when an active admin exists; setup/invite links are single-use, hashed, and expire (15 min / 48 h)
- [ ] No admin password in env vars, CLI arguments, or logs; invitee alone chooses their password and MFA
- [ ] Invitations cannot grant roles beyond the inviter's own; emergency CLI commands revoke sessions and raise alerts

**Authorization**
- [ ] Startup fails if any route lacks a policy; CI route-coverage test passes
- [ ] Role × endpoint authorization matrix test passes
- [ ] IDOR tests pass for every customer-owned resource
- [ ] Escalation rules and last-admin protection verified with tests

**Browser & transport**
- [ ] CSRF (Origin + token) enforced on all state-changing cookie requests
- [ ] Nonce-based CSP enforced on admin; security headers present on all hosts
- [ ] Per-host proxy allow-lists verified (public host returns 404 for `/api/admin/*`)
- [ ] HSTS on; no mixed content; no dangling DNS records

**Data & business integrity**
- [ ] Server-side recomputation of totals; money stored as integers
- [ ] Sales/inventory/payments in single transactions; idempotency constraints verified
- [ ] Financial and audit tables reject UPDATE/DELETE
- [ ] Refund/void/discount limits and approvals enforced

**POS & real-time**
- [ ] Device enrollment, revocation, and refresh-token reuse detection tested
- [ ] WebSocket Origin check, server-assigned subscriptions, and close-on-revoke verified
- [ ] POS local database encrypted

**Operations**
- [ ] Rate limits tuned and tested; `trustProxy` correct
- [ ] Audit logs shipped off-box; alerts firing in tests
- [ ] Backups encrypted and a restore successfully tested
- [ ] DB roles least-privilege; DB not publicly reachable
- [ ] Secrets scanning, dependency scanning, and image scanning green in CI
- [ ] Admin host behind VPN/Zero Trust/IP allow-list (recommended)

**Product & engineering quality**
- [ ] Design tokens applied everywhere; no hard-coded colors/spacing; single icon set
- [ ] Every screen has loading, empty, error, and permission-denied states
- [ ] No placeholder content, dead buttons, fake data, or lorem ipsum in production builds
- [ ] Strict TypeScript, lint, typecheck, and tests gate every merge; no `any` / `console.log`
- [ ] README, ADRs, and operations runbook (deploy, restore, key rotation, CLI recovery) are written and current
- [ ] Accessibility (WCAG 2.2 AA) and RTL/Arabic checks pass on key flows

---

# 27. Final Architecture

```text
                              LINGO STORE
                                   |
        +--------------------------+--------------------------+
        |                          |                          |
        v                          v                          v
 PUBLIC WEBSITE             ADMIN APPLICATION           POS DEVICE API
 lingostore.example         admin.lingostore.example    pos.lingostore.example
 customer session           staff session + MFA         device + cashier tokens
 (__Host-lingo_sid)         (__Host-lingo_admin_sid)    (opaque bearer, rotating)
        |                          |                          |
        +--------------------------+--------------------------+
                                   |
                       REVERSE PROXY (TLS, per-host allow-list,
                         rate limits, header hygiene)
                                   |
                                   v
                             FASTIFY API
            deny-by-default policy registry · RBAC · audit
                                   |
                  +----------------+----------------+
                  v                v                v
             PostgreSQL        WebSocket          Jobs
        (least-privilege roles)  (/ws/admin,
                  |               /ws/pos)
                  v
            Central Data
                  ^
                  |
             POS Clients (Flutter)
                  |
                  v
           Local Hardware / Thermal Printer
```

## Final Decision

Lingo Store is **one platform with three isolated access surfaces**: a public customer website, an admin application on its own hostname behind mandatory MFA, and a device-authenticated POS API. They share one API codebase, one database, and one authorization engine, but **not** cookies, sessions, identities, bundles, or network exposure.

---

# Appendix A — What Changed from v1

| Area | v1 | v2 | Reason |
|---|---|---|---|
| Admin location | `/admin` on same domain | `admin.` subdomain, separate Next.js app | Isolates origin from public XSS; separate cookies and bundle |
| Identity | Shared `users` table, role `user` | `staff_users` and `customer_accounts` split | Customer can never obtain staff authority; no role field to tamper with |
| MFA | Optional / future | Mandatory for staff | Admin controls money, stock, and PII |
| Sessions | Generic secure cookies | Hashed server sessions, `__Host-`, per-principal timeouts, rotation, revocation | Concrete, testable controls |
| CSRF | "SameSite protection" | Origin + Fetch-Metadata + token required | Subdomains are same-site, so SameSite alone is insufficient |
| Authorization | Role/permission checks | Deny-by-default registry, object-level scope, escalation rules, last-admin guard | Prevents IDOR, forgotten routes, privilege escalation |
| Next.js | Route guards | Server-side check; middleware only for UX | Middleware-bypass vulnerabilities |
| POS | "Authentication" (undefined) | Device enrollment, short-lived tokens, rotation + reuse detection, encrypted local DB | Stolen-device and offline-sync risks |
| Money | Not specified | Integer minor units, server-side totals, idempotency, immutability, refund rules | Protects financial integrity |
| WebSocket | Event list only | Origin check, server-assigned channels, close-on-revoke | Prevents hijacking and data leaks |
| Audit | Success actions | Includes denials/failures, append-only, off-box shipping, alerts | Tamper resistance and detection |
| Exports | Mentioned | Permissioned, step-up, CSV-injection protection | Data exfiltration / formula injection |
| Errors | 401 vs 403 inconsistent | 401 unauthenticated, 403 forbidden, 404 for foreign objects | Consistency, no enumeration |
| Admin POS screen | Listed in UI but not in routes | POS = Flutter client; admin manages devices/cash sessions | Removed inconsistency |
| Infra / CI | Not covered | Hardening, secrets, scanning, backups, restore drills | Operational security |
| Staff provisioning | Not specified | CLI bootstrap for first admin, invitation flow for staff, emergency CLI recovery, no admin-known passwords | Safe account creation without default or shared credentials |
| UI / engineering quality | Not covered | Design system and tokens, state coverage, admin ergonomics, RTL/a11y, strict TypeScript, CI gates, tests, ADRs and runbook | Production-grade, maintainable product rather than a template |
