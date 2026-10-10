-- POS clients are devices, not browser sessions. Opaque access and refresh
-- tokens are stored hashed; a refresh-token family is revoked on reuse.
CREATE TABLE "DeviceSession" (
  "id" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "accessExpiresAt" TIMESTAMPTZ NOT NULL,
  "refreshExpiresAt" TIMESTAMPTZ NOT NULL,
  "rotatedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE,
  CONSTRAINT "DeviceSession_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "DeviceSession_accessTokenHash_key" ON "DeviceSession" ("accessTokenHash");
CREATE UNIQUE INDEX "DeviceSession_refreshTokenHash_key" ON "DeviceSession" ("refreshTokenHash");
CREATE INDEX "DeviceSession_terminalId_revokedAt_idx" ON "DeviceSession" ("terminalId", "revokedAt");
CREATE INDEX "DeviceSession_staffUserId_revokedAt_idx" ON "DeviceSession" ("staffUserId", "revokedAt");
CREATE INDEX "DeviceSession_familyId_idx" ON "DeviceSession" ("familyId");

REVOKE DELETE ON "DeviceSession" FROM lingo_app;
GRANT SELECT, INSERT, UPDATE ON "DeviceSession" TO lingo_app;
