import assert from "node:assert/strict";
import { money, qtyMilli, minorForQuantity } from "../money.js";

assert.equal(money(12345), 12345n);
assert.equal(qtyMilli("1"), 1000n);
assert.equal(qtyMilli("1.25"), 1250n);
assert.equal(qtyMilli("0.001"), 1n);
assert.equal(minorForQuantity(199n, "1.5"), 298n);
assert.throws(() => money(1.2), /INVALID_MONEY/);
assert.throws(() => qtyMilli("1.2345"), /INVALID_QUANTITY/);
process.stdout.write("money and quantity tests passed\n");
