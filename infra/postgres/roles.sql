-- Run as a database administrator during deployment. Set passwords out of band.
-- The migration connection must use lingo_migrator; the API must use lingo_app.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_app') THEN
    CREATE ROLE lingo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_migrator') THEN
    CREATE ROLE lingo_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_readonly') THEN
    CREATE ROLE lingo_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, lingo_app, lingo_readonly;
GRANT USAGE ON SCHEMA public TO lingo_app, lingo_readonly;
GRANT USAGE, CREATE ON SCHEMA public TO lingo_migrator;

-- Existing objects: application data access; no broad DELETE grant.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lingo_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lingo_readonly;
GRANT DELETE ON "StaffRoleAssignment", "RolePermission", "MfaCredential", "RecoveryCode" TO lingo_app;
REVOKE UPDATE, DELETE ON "AuditLog" FROM lingo_app;
GRANT SELECT, INSERT ON "AuditLog" TO lingo_app;

-- Financial and inventory history is append-only. Sale status is the sole
-- permitted update because refunds change its derived status.
REVOKE UPDATE, DELETE ON "Payment", "Refund", "InventoryMovement",
  "CustomerPayment", "SupplierPayment", "Expense", "SaleItem",
  "PurchaseItem", "Purchase" FROM lingo_app;
REVOKE UPDATE, DELETE ON "Sale" FROM lingo_app;
GRANT UPDATE ("status") ON "Sale" TO lingo_app;

-- Prisma migrations run as lingo_migrator. New tables inherit only the same
-- runtime access, and audit logs remain insert/select only.
ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO lingo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO lingo_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
  REVOKE DELETE ON TABLES FROM lingo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lingo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO lingo_readonly;

-- Existing deployments must use the migration role as owner so that grants
-- above and migrations are consistently managed by a separate credential.
