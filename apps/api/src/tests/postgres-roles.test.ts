import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const roles = readFileSync(`${root}/infra/postgres/roles.sql`, "utf8");
const restrictiveDefaults = readFileSync(
  `${root}/prisma/migrations/20261016_append_only_default_update_guard/migration.sql`,
  "utf8",
);

test("runtime PostgreSQL roles are explicitly least-privileged", () => {
  for (const role of ["lingo_app", "lingo_migrator", "lingo_readonly"]) {
    assert.match(
      roles,
      new RegExp(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`),
    );
  }
  assert.match(roles, /REVOKE CREATE ON SCHEMA public FROM PUBLIC, lingo_app, lingo_readonly/);
  assert.match(roles, /GRANT USAGE, CREATE ON SCHEMA public TO lingo_migrator/);
  assert.match(roles, /REVOKE UPDATE, DELETE ON "AuditLog" FROM lingo_app/);
  assert.match(
    roles,
    /REVOKE UPDATE, DELETE ON "Payment", "Refund", "InventoryMovement",[\s\S]*"Purchase" FROM lingo_app/,
  );
  assert.match(roles, /GRANT UPDATE \("status"\) ON "Sale" TO lingo_app/);
  assert.match(
    roles,
    /ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public\s+GRANT SELECT, INSERT ON TABLES TO lingo_app/,
  );
  assert.match(
    roles,
    /ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public\s+REVOKE UPDATE, DELETE ON TABLES FROM lingo_app/,
  );
  assert.match(
    restrictiveDefaults,
    /ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public\s+REVOKE UPDATE ON TABLES FROM lingo_app/,
  );
  assert.match(
    restrictiveDefaults,
    /ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public\s+REVOKE DELETE ON TABLES FROM lingo_app/,
  );
});
