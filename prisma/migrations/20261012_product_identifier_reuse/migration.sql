-- Product identifiers remain unique among active catalog rows only.
-- Archived products keep their historical SKU/barcode and no longer reserve them.
DROP INDEX IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Product_barcode_key";

CREATE UNIQUE INDEX "Product_sku_active_key"
  ON "Product" ("sku")
  WHERE "archivedAt" IS NULL;

CREATE UNIQUE INDEX "Product_barcode_active_key"
  ON "Product" ("barcode")
  WHERE "archivedAt" IS NULL;
