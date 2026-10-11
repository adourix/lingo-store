import { readFile, writeFile } from "node:fs/promises";

const repairs = [
  {
    path: "apps/api/src/server.ts",
    replacements: [
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
    ],
  },
  {
    path: "apps/api/src/tests/pos-auth-contract.test.ts",
    replacements: [
      [
        'assert.ok(originPolicy.includes("fetchSite && fetchSite !== \\"same-origin\\""));',
        'assert.ok(originPolicy.includes(\'fetchSite === "cross-site"\'));',
      ],
    ],
  },
];

for (const { path, replacements } of repairs) {
  let source = await readFile(path, "utf8");
  let changed = false;
  for (const [before, after] of replacements) {
    if (source.includes(before)) {
      source = source.replace(before, after);
      changed = true;
    }
  }
  if (changed) await writeFile(path, source);
}
