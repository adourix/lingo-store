-- Runtime application-role privileges.
-- The database roles are provisioned outside Prisma migrations. Keep this migration
-- idempotent so a migration deploy remains safe when the roles already exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO lingo_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lingo_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lingo_app';

    -- Audit history is append-only for the runtime application role.
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM lingo_app';

    -- Web-order line items and cash receipts are immutable history.
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "WebOrderItem" FROM lingo_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "WebOrderCashReceipt" FROM lingo_app';

    -- An order may only transition through its mutable lifecycle/payment fields.
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "WebOrder" FROM lingo_app';
    EXECUTE 'GRANT UPDATE ("status", "paymentStatus", "version", "updatedAt") ON TABLE "WebOrder" TO lingo_app';
  END IF;
END $$;
