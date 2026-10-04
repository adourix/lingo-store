-- Financial/audit immutability hardening for PostgreSQL deployments.
CREATE OR REPLACE FUNCTION lingo_reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('DELETE','UPDATE') THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: %', TG_TABLE_NAME USING ERRCODE = '55006';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lingo_sale_status_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: Sale' USING ERRCODE = '55006';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.invoiceNo IS DISTINCT FROM OLD.invoiceNo OR
    NEW.subtotalMinor IS DISTINCT FROM OLD.subtotalMinor OR
    NEW.discountMinor IS DISTINCT FROM OLD.discountMinor OR
    NEW.totalMinor IS DISTINCT FROM OLD.totalMinor OR
    NEW.paidMinor IS DISTINCT FROM OLD.paidMinor OR
    NEW.customerId IS DISTINCT FROM OLD.customerId OR
    NEW.cashierId IS DISTINCT FROM OLD.cashierId OR
    NEW.terminalId IS DISTINCT FROM OLD.terminalId OR
    NEW.createdAt IS DISTINCT FROM OLD.createdAt
  ) THEN
    RAISE EXCEPTION 'SALE_STATUS_ONLY' USING ERRCODE = '55006';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lingo_immutable_payment ON "Payment";
CREATE TRIGGER lingo_immutable_payment BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_refund ON "Refund";
CREATE TRIGGER lingo_immutable_refund BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_inventory_movement ON "InventoryMovement";
CREATE TRIGGER lingo_immutable_inventory_movement BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_customer_payment ON "CustomerPayment";
CREATE TRIGGER lingo_immutable_customer_payment BEFORE UPDATE OR DELETE ON "CustomerPayment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_supplier_payment ON "SupplierPayment";
CREATE TRIGGER lingo_immutable_supplier_payment BEFORE UPDATE OR DELETE ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_expense ON "Expense";
CREATE TRIGGER lingo_immutable_expense BEFORE UPDATE OR DELETE ON "Expense" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_sale_item ON "SaleItem";
CREATE TRIGGER lingo_immutable_sale_item BEFORE UPDATE OR DELETE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_purchase_item ON "PurchaseItem";
CREATE TRIGGER lingo_immutable_purchase_item BEFORE UPDATE OR DELETE ON "PurchaseItem" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_purchase ON "Purchase";
CREATE TRIGGER lingo_immutable_purchase BEFORE UPDATE OR DELETE ON "Purchase" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_immutable_audit_log ON "AuditLog";
CREATE TRIGGER lingo_immutable_audit_log BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION lingo_reject_immutable_mutation();
DROP TRIGGER IF EXISTS lingo_sale_status_only_trigger ON "Sale";
CREATE TRIGGER lingo_sale_status_only_trigger BEFORE UPDATE OR DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION lingo_sale_status_only();

REVOKE UPDATE, DELETE ON "Payment","Refund","InventoryMovement","CustomerPayment","SupplierPayment","Expense","SaleItem","PurchaseItem","Purchase","AuditLog" FROM lingo_app;
REVOKE UPDATE, DELETE ON "Sale" FROM lingo_app;
GRANT UPDATE ("status") ON "Sale" TO lingo_app;
