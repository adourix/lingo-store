import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL;

test("PostgreSQL schema smoke test", { skip: !url }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;

    const requiredTables = [
      "StaffUser",
      "Role",
      "Permission",
      "StaffRoleAssignment",
      "Product",
      "InventoryMovement",
      "Sale",
      "Payment",
      "Refund",
      "WebOrder",
      "WebOrderItem",
      "WebOrderCashReceipt",
      "AuditLog",
    ];
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${requiredTables})
    `;
    assert.deepEqual(
      new Set(tables.map((row) => row.table_name)),
      new Set(requiredTables),
      "required application tables are missing",
    );

    const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname
      FROM pg_roles
      WHERE rolname = ANY(ARRAY['lingo_app','lingo_migrator','lingo_readonly'])
    `;
    assert.deepEqual(
      new Set(roles.map((row) => row.rolname)),
      new Set(["lingo_app", "lingo_migrator", "lingo_readonly"]),
      "required database roles are missing",
    );

    const managerPermissions = await prisma.$queryRaw<Array<{ key: string }>>`
      SELECT p.key
      FROM "RolePermission" rp
      JOIN "Role" r ON r.id = rp."roleId"
      JOIN "Permission" p ON p.id = rp."permissionId"
      WHERE r.name = 'manager'
        AND p.key IN ('admin.access', 'roles.manage', 'settings.manage')
    `;
    const managerPermissionKeys = new Set(managerPermissions.map((row) => row.key));
    assert.equal(managerPermissionKeys.has("admin.access"), true);
    assert.equal(managerPermissionKeys.has("roles.manage"), false);
    assert.equal(managerPermissionKeys.has("settings.manage"), false);

    const auditMutations = await prisma.$queryRaw<
      Array<{ grantee: string; privilege_type: string }>
    >`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'AuditLog'
        AND grantee = 'lingo_app'
        AND privilege_type IN ('UPDATE', 'DELETE', 'INSERT', 'SELECT')
    `;
    const auditPrivileges = new Set(auditMutations.map((row) => row.privilege_type));
    assert.equal(auditPrivileges.has("SELECT"), true);
    assert.equal(auditPrivileges.has("INSERT"), true);
    assert.equal(auditPrivileges.has("UPDATE"), false);
    assert.equal(auditPrivileges.has("DELETE"), false);

    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'lingo_immutable_audit_log',
          'lingo_immutable_web_order_item',
          'lingo_immutable_web_order_cash_receipt',
          'lingo_web_order_transition_guard',
          'lingo_web_order_cash_receipt_guard'
        )
    `;
    for (const trigger of [
      "lingo_immutable_audit_log",
      "lingo_immutable_web_order_item",
      "lingo_immutable_web_order_cash_receipt",
      "lingo_web_order_transition_guard",
      "lingo_web_order_cash_receipt_guard",
    ])
      assert.ok(triggers.some((row) => row.tgname === trigger), `missing trigger: ${trigger}`);
  } finally {
    await prisma.$disconnect();
  }
});
