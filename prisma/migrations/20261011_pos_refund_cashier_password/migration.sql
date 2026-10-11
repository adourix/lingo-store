INSERT INTO "Setting" ("id", "key", "value", "updatedAt")
VALUES (gen_random_uuid(), 'pos.refund.maxMinor', '9007199254740991'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "updatedAt" = CURRENT_TIMESTAMP;
