ALTER TABLE "CustomerAccount" ADD COLUMN IF NOT EXISTS "businessCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAccount_businessCustomerId_key" ON "CustomerAccount" ("businessCustomerId") WHERE "businessCustomerId" IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_businessCustomerId_fkey"
    FOREIGN KEY ("businessCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
