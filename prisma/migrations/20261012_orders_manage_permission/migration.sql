-- Web order lifecycle mutations are a sales-management capability.
-- Preserve least privilege by granting the new permission to every existing
-- role that already has sales.view; roles without sales visibility do not gain
-- access to customer-order mutations.
INSERT INTO "Permission" ("id", "key", "description")
SELECT gen_random_uuid()::text, 'orders.manage', 'Confirm, process, ready, cancel, and collect cash for web orders'
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "key" = 'orders.manage'
);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" AS role
JOIN "Permission" AS sales_permission
  ON sales_permission."key" = 'sales.view'
JOIN "Permission" AS permission
  ON permission."key" = 'orders.manage'
WHERE EXISTS (
  SELECT 1
  FROM "RolePermission" AS existing
  WHERE existing."roleId" = role."id"
    AND existing."permissionId" = sales_permission."id"
)
ON CONFLICT DO NOTHING;
