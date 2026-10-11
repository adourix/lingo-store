-- Fix PostgreSQL trigger field references for Prisma's quoted camelCase columns.
-- Existing deployments already have the original trigger, so repair it with a new migration.
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
    NEW."invoiceNo" IS DISTINCT FROM OLD."invoiceNo" OR
    NEW."subtotalMinor" IS DISTINCT FROM OLD."subtotalMinor" OR
    NEW."discountMinor" IS DISTINCT FROM OLD."discountMinor" OR
    NEW."totalMinor" IS DISTINCT FROM OLD."totalMinor" OR
    NEW."paidMinor" IS DISTINCT FROM OLD."paidMinor" OR
    NEW."customerId" IS DISTINCT FROM OLD."customerId" OR
    NEW."cashierId" IS DISTINCT FROM OLD."cashierId" OR
    NEW."terminalId" IS DISTINCT FROM OLD."terminalId" OR
    NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'SALE_STATUS_ONLY' USING ERRCODE = '55006';
  END IF;

  RETURN NEW;
END;
$$;
