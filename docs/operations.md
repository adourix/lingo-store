# Lingo Store Operations Runbook

## Production configuration

Required secrets are injected outside the repository:
- DATABASE_URL: PostgreSQL application role (\`lingo_app\`)
- MFA_ENCRYPTION_KEY: base64-encoded 32-byte key
- ADMIN_ORIGIN / POS_ORIGIN / PUBLIC_ORIGIN
- MAILER_WEBHOOK_URL
- TURNSTILE_SECRET_KEY

Do not set bootstrap passwords in environment variables.

## Database

1. Provision PostgreSQL privately.
2. Run \`prisma db push\` only for local development.
3. In production use reviewed migrations and then apply \`infra/postgres/roles.sql\` with a database administrator.
4. The API must use \`lingo_app\`; migrations use \`lingo_migrator\`; reporting uses \`lingo_readonly\`.
5. Verify the database is not published to the internet.

## First administrator

After the RBAC seed is complete:

\`\`\`bash
node dist/cli.js admin:create --email owner@lingostore.example --name "Owner"
\`\`\`

The command prints a single-use 15-minute setup URL. It never accepts or prints a password.

## Emergency recovery

\`\`\`bash
node dist/cli.js admin:issue-setup-link --email owner@lingostore.example
node dist/cli.js admin:reset-mfa --email owner@lingostore.example
\`\`\`

Both commands run on the server, revoke sessions, and are audited.

## Staff invitations

Admin UI invitations require \`users.create\`, \`users.assign_role\`, and step-up. The invitation token is never returned to the inviter. A mail adapter delivers the setup link and temporary MFA secret to the invitee. Links expire after 48 hours and are single-use.

## Terminal setup

1. Admin creates an enrollment code with \`terminals.manage\` + step-up.
2. Open \`pos.lingostore.example/enroll\` on the shop terminal.
3. Enter the one-time code and a terminal name.
4. The terminal credential is stored only in the HttpOnly host cookie and is rotated on every POS login.
5. Revoke lost/replaced terminals immediately.

## Key rotation

- Rotate \`MFA_ENCRYPTION_KEY\` only with a migration/re-encryption procedure; existing encrypted MFA credentials must be decrypted with the old key and re-encrypted with the new key.
- Rotate database credentials out-of-band.
- Rotate mail/CAPTCHA provider credentials out-of-band.

## Backup and restore

Backups must be encrypted and stored off-site. A restore drill is required before launch and periodically thereafter. Never restore production data into development without masking PII.

## POS hardening

Use a dedicated non-admin OS account, encrypted disk, automatic security updates, managed Chromium kiosk mode, no extensions, no personal browsing, and automatic POS startup. Keep a terminal inventory and revoke anything unaccounted for.

## Deployment

1. Run dependency, secret, SAST, typecheck, unit/security tests.
2. Apply reviewed Prisma migrations.
3. Apply PostgreSQL grants/triggers.
4. Deploy API and the three frontend builds.
5. Validate Nginx host allow-lists, TLS, HSTS, CSP, WebSocket Origin checks, and health.
6. Pilot one terminal before broad rollout.
