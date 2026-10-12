-- The previous repair assumed Prisma's historical FK name. Remove every
-- foreign key attached to Product.categoryId so a stale RESTRICT FK cannot
-- coexist with the intended ON DELETE SET NULL constraint.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint AS con
    JOIN pg_attribute AS att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = '"Product"'::regclass
      AND con.contype = 'f'
      AND att.attname = 'categoryId'
  LOOP
    EXECUTE format('ALTER TABLE "Product" DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE "Product"
  ALTER COLUMN "categoryId" DROP NOT NULL;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId")
  REFERENCES "Category"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
