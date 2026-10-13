-- Backfill products created by the legacy metadata-in-description implementation.
-- This is a one-time compatibility migration; new products use Product.imageUrl directly.
UPDATE "Product"
SET "imageUrl" = (regexp_match(
  "description",
  '"imageUrl"[[:space:]]*:[[:space:]]*"([^\"]+)"'
))[1]
WHERE "imageUrl" IS NULL
  AND "description" IS NOT NULL
  AND "description" LIKE '%[[LINGO_PRODUCT_META]]%'
  AND regexp_match(
    "description",
    '"imageUrl"[[:space:]]*:[[:space:]]*"([^\"]+)"'
  ) IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_app') THEN
    EXECUTE 'GRANT SELECT, UPDATE ("imageUrl") ON TABLE "Product" TO lingo_app';
  END IF;
END $$;
