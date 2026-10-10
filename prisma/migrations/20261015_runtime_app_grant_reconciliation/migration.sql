-- Reconcile the runtime role grants against the current schema.
-- This is intentionally idempotent so it also repairs databases where the
-- previous role-policy migration was recorded but the grants were absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO lingo_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lingo_app';
    EXECUTE 'REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM lingo_app';

    EXECUTE 'GRANT DELETE ON TABLE "StaffRoleAssignment", "RolePermission", "MfaCredential", "RecoveryCode" TO lingo_app';

    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM lingo_app';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE "AuditLog" TO lingo_app';

    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "Payment", "Refund", "InventoryMovement", "CustomerPayment", "SupplierPayment", "Expense", "SaleItem", "PurchaseItem", "Purchase" FROM lingo_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "Sale" FROM lingo_app';
    EXECUTE 'GRANT UPDATE ("status") ON TABLE "Sale" TO lingo_app';

    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "WebOrderItem", "WebOrderCashReceipt" FROM lingo_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "WebOrder" FROM lingo_app';
    EXECUTE 'GRANT UPDATE ("status", "paymentStatus", "version", "updatedAt") ON TABLE "WebOrder" TO lingo_app';

    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO lingo_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public REVOKE DELETE ON TABLES FROM lingo_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lingo_app';
  END IF;
END $$;
