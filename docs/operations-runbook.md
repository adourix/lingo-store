# Lingo Store Operations Runbook

## Local
1. Copy `.env.example` to `.env`.
2. Start PostgreSQL privately.
3. Run `pnpm install`.
4. Run `pnpm db:generate`.
5. Apply Prisma migrations with the migrator credentials.
6. Run `pnpm db:seed` only for a development/bootstrap environment.
7. Start the apps with `pnpm dev`.

## Production deployment
- PostgreSQL is private; never publish port 5432.
- Use a dedicated migrator DB role for schema changes and a restricted application DB role at runtime.
- Put Nginx/Caddy in front of all three hosts; expose only 80/443.
- Set a unique production `PASSWORD_PEPPER`, MFA encryption key, database credentials, and allowed origins outside the repository.
- Require TLS and Secure cookies in production.
- Admin should be additionally protected by VPN/Zero Trust/IP policy where practical.
- POS terminals use a managed Chromium kiosk profile.

## Backup and restore
- Encrypt database backups and store them off-site.
- Before a restore, stop writes and record the target backup timestamp.
- Restore into an isolated PostgreSQL instance first.
- Run schema/integrity checks and smoke-test authentication, inventory, sales, refunds, and cash sessions.
- Only then promote the restored database.

## Key rotation
- Rotate DB credentials independently for app/migrator/reporting roles.
- Rotate password pepper only with a planned password rehash migration.
- Rotate MFA encryption material using an explicit decrypt/re-encrypt procedure; never log secrets.
- Revoke all sessions after an incident involving session-cookie compromise.
- Revoke affected POS terminals immediately.

## Incident response
- Revoke compromised sessions/terminals.
- Disable affected staff accounts.
- Preserve audit and application logs.
- Review denied logins, role changes, terminal events, refunds, exports, and offline `NEEDS_REVIEW` sales.
- Rotate affected credentials and document the incident.

## Terminal setup
- Dedicated non-admin OS account.
- Auto-updates and disk encryption where available.
- Chromium kiosk mode locked to the POS host.
- No personal browsing or extensions.
- Printer configured as an OS printer; browser printing is the default.
