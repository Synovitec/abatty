import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { importersOf } from "../src/core/imports.mjs";
import { parseJsonc } from "../src/core/ts-paths.mjs";

// The import graph read only a relative specifier naming the file exactly, so a TypeScript
// product (`./price`, `@/lib/price`) had no edges: `abatty mutate` found no test for any module
// it changed, and the gate could not tell a broken module from a flake.

test("TypeScript imports reach their module: no extension, an index, a .js for .ts, an alias", () => {
  const dir = tempRepo("imports-ts", {
    "tsconfig.json":
      '{\n  // the app\'s alias\n  "compilerOptions": { "paths": { "@/*": ["./src/*"], }, },\n}\n',
    "src/price.ts": "export const price = 1;\n",
    "src/cart/index.ts": "export const cart = 1;\n",
    "src/tax.ts": "export const tax = 1;\n",
    "src/money.tsx": "export const money = 1;\n",
    "src/a.test.ts": 'import { price } from "./price";\nimport { cart } from "./cart";\n',
    "src/b.test.ts": 'import { tax } from "./tax.js";\nimport { money } from "@/money";\n',
    "src/c.ts": 'import { x } from "react";\n',
  });
  const graph = importersOf(dir);
  assert.deepEqual(graph.get("src/price.ts"), ["src/a.test.ts"]);
  assert.deepEqual(graph.get("src/cart/index.ts"), ["src/a.test.ts"]);
  assert.deepEqual(graph.get("src/tax.ts"), ["src/b.test.ts"]);
  assert.deepEqual(graph.get("src/money.tsx"), ["src/b.test.ts"]);
  assert.equal([...graph.values()].flat().includes("src/c.ts"), false, "a package is no edge");
});

test("a workspace's alias is its own, and an alias another tsconfig declares does not leak", () => {
  const dir = tempRepo("imports-ws-alias", {
    "apps/web/tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
    "apps/web/lib/x.ts": "export const x = 1;\n",
    "apps/web/x.test.ts": 'import { x } from "@/lib/x";\n',
    "lib/x.ts": "export const x = 2;\n",
    "other.test.ts": 'import { x } from "@/lib/x";\n',
  });
  const graph = importersOf(dir);
  assert.deepEqual(graph.get("apps/web/lib/x.ts"), ["apps/web/x.test.ts"]);
  assert.equal(graph.get("lib/x.ts"), undefined);
});

test("a tsconfig's comments and trailing commas are read, a // inside a string is kept", () => {
  assert.deepEqual(parseJsonc('{ /* c */ "a": "http://x", // d\n "b": [1,], }'), {
    a: "http://x",
    b: [1],
  });
});
