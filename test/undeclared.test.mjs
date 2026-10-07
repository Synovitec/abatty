import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";
import { undeclaredImports } from "../src/core/undeclared.mjs";

// An adopter imported `server-only` from 13 files without declaring it: the gate read 13
// import-graph errors and 13 dead-code findings, and nothing said the one thing to do.

const PKG = JSON.stringify({ name: "app", dependencies: { next: "15", "@acme/ui": "1" } });

test("a package imported and declared nowhere is named once, with its file count", () => {
  const dir = tempRepo("undeclared", {
    "package.json": PKG,
    "src/a.ts": 'import "server-only";\nimport { x } from "next/server";\n',
    "src/b.ts": 'import "server-only";\nconst z = require("zod");\n',
  });
  assert.deepEqual(undeclaredImports(dir), [
    { name: "server-only", files: 2 },
    { name: "zod", files: 1 },
  ]);
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(
    doc.out,
    /imported and declared in no package\.json: server-only \(2 file\(s\)\), zod \(1 file\(s\)\)/,
  );
});

test("builtins, virtual modules, aliases, workspaces, strings and comments are not packages", () => {
  const dir = tempRepo("undeclared-clean", {
    "package.json": JSON.stringify({ name: "mono", workspaces: ["packages/*"] }),
    "packages/ui/package.json": JSON.stringify({ name: "@mono/ui" }),
    "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }\n',
    "src/a.ts": [
      'import fs from "node:fs";',
      'import path from "path";',
      'import { getCollection } from "astro:content";',
      'import { x } from "@/lib/x";',
      'import { Button } from "@mono/ui";',
      "const fixture = 'import \"not-a-real-import\"';",
      '// import "commented-out"',
      "",
    ].join("\n"),
  });
  assert.deepEqual(undeclaredImports(dir), []);
});

test("a method named import or require is no module load; the real forms still are", () => {
  // A rich-text editor's Quill.import('delta') was read as an import of a package named delta.
  const dir = tempRepo("undeclared-method", {
    "package.json": JSON.stringify({ name: "p" }),
    "src/editor.js":
      "const Delta = Quill.import('delta');\nconst x = registry.require('blots');\nconst z = await import('zod');\n",
  });
  assert.deepEqual(
    undeclaredImports(dir).map((u) => u.name),
    ["zod"],
  );
});
