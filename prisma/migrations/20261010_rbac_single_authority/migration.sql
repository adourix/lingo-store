-- Move existing staff role assignments into the RBAC tables before removing
-- the legacy enum column. Permissions remain authoritative through RolePermission.
INSERT INTO "Role" ("id", "name")
SELECT gen_random_uuid()::text, legacy_role."name"
FROM (SELECT DISTINCT lower("role"::text) AS "name" FROM "StaffUser") AS legacy_role
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "StaffRoleAssignment" ("staffUserId", "roleId")
SELECT staff."id", role."id"
FROM "StaffUser" AS staff
JOIN "Role" AS role ON role."name" = lower(staff."role"::text)
WHERE NOT EXISTS (
  SELECT 1 FROM "StaffRoleAssignment" AS assignment
  WHERE assignment."staffUserId" = staff."id"
);

UPDATE "StaffInvitation"
SET "roleName" = lower("role"::text)
WHERE "roleName" IS NULL;
ALTER TABLE "StaffUser" DROP COLUMN "role";
ALTER TABLE "StaffInvitation" DROP COLUMN "role";
DROP TYPE IF EXISTS "StaffRole";

-- Standardize the device-management permission name from the legacy registry.
INSERT INTO "Permission" ("id", "key", "description")
SELECT gen_random_uuid()::text, 'devices.manage', 'Enroll, inspect, and revoke POS devices'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'devices.manage');
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT assignment."roleId", current_permission."id"
FROM "RolePermission" AS assignment
JOIN "Permission" AS legacy_permission ON legacy_permission."id" = assignment."permissionId"
JOIN "Permission" AS current_permission ON current_permission."key" = 'devices.manage'
WHERE legacy_permission."key" = 'terminals.manage'
ON CONFLICT DO NOTHING;
DELETE FROM "Permission" WHERE "key" = 'terminals.manage';
