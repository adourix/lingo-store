import { readFile, writeFile } from "node:fs/promises";

const path = "apps/api/src/server.ts";
const source = await readFile(path, "utf8");
const replacements = [
  [
    '      include: { sale: { select: { id: true, invoiceNo: true } } },\n    }),\n);',
    '      include: { sale: { select: { id: true, invoiceNo: true } } },\n    }),\n  ),\n);',
  ],
  [
    '      include: { customer: { select: { id: true, name: true } } },\n    }),\n);',
    '      include: { customer: { select: { id: true, name: true } } },\n    }),\n  ),\n);',
  ],
  [
    '        terminal: { select: { id: true, name: true } },\n      },\n    }),\n);',
    '        terminal: { select: { id: true, name: true } },\n      },\n    }),\n  ),\n);',
  ],
  [
    '          },\n        },\n      },\n    }),\n);\napp.get<ApiRouteGeneric>("/api/admin/categories"',
    '          },\n        },\n      },\n    }),\n  ),\n);\napp.get<ApiRouteGeneric>("/api/admin/categories"',
  ],
];

let output = source;
let changed = false;
for (const [before, after] of replacements) {
  if (output.includes(before)) {
    output = output.replace(before, after);
    changed = true;
  }
}

if (changed) await writeFile(path, output);
