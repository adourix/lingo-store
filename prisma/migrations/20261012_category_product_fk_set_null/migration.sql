-- Keep category deletion safe: products must be detached when their category is deleted.
-- This also repairs databases where the historical FK was created without ON DELETE SET NULL.
ALTER TABLE "Product"
  ALTER COLUMN "categoryId" DROP NOT NULL;

ALTER TABLE "Product"
  DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId")
  REFERENCES "Category"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
