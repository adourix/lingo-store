-- Persistent per-customer favorites for the public storefront.
CREATE TABLE "CustomerFavorite" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "customerAccountId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerFavorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerFavorite_customerAccountId_productId_key" UNIQUE ("customerAccountId", "productId"),
  CONSTRAINT "CustomerFavorite_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerFavorite_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CustomerFavorite_customerAccountId_createdAt_idx"
  ON "CustomerFavorite" ("customerAccountId", "createdAt");

-- Keep the application role aligned with the DML-only production model.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CustomerFavorite" TO lingo_app;
