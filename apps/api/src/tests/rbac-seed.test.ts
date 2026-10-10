import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const seed = readFileSync(fileURLToPath(new URL("../../seed.ts", import.meta.url)), "utf8");
const managerBlock = seed.match(/const managerKeys = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(managerBlock, "manager permission registry must exist");
assert.match(managerBlock[1], /"admin\.access"/);
assert.match(managerBlock[1], /"dashboard\.view"/);
assert.match(managerBlock[1], /"orders\.manage"/);
assert.doesNotMatch(managerBlock[1], /"roles\.manage"/);
assert.doesNotMatch(managerBlock[1], /"settings\.manage"/);

process.stdout.write("RBAC seed role boundary tests passed\n");
