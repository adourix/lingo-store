ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

UPDATE "Product" SET "imageUrl"=(regexp_match("description", '\[\[LINGO_PRODUCT_META\]\]\{[^}]*"imageUrl":"([^"]+)"'))[1]
WHERE "description" IS NOT NULL AND "description" LIKE '%[[LINGO_PRODUCT_META]]%' AND regexp_match("description", '\[\[LINGO_PRODUCT_META\]\]\{[^}]*"imageUrl":"([^"]+)"') IS NOT NULL;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lingo_app') THEN EXECUTE 'GRANT SELECT, UPDATE ("imageUrl") ON TABLE "Product" TO lingo_app'; END IF; END $$;
