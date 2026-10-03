-- Run by a database administrator during deployment.
-- Passwords are injected out-of-band; never commit credentials.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lingo_app') THEN CREATE ROLE lingo_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lingo_migrator') THEN CREATE ROLE lingo_migrator NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lingo_readonly') THEN CREATE ROLE lingo_readonly NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO lingo_app, lingo_readonly;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO lingo_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lingo_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO lingo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lingo_readonly;

-- Keep audit and financial immutability enforced by triggers; application code should not receive DELETE grants on these tables.
REVOKE DELETE,UPDATE ON "AuditLog","Payment","Refund","InventoryMovement","CustomerPayment","SupplierPayment","Expense","SaleItem","PurchaseItem" FROM lingo_app;
