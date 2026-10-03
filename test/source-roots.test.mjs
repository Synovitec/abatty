import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

// The graph read `src` alone where a src/ existed, and knip a fixed src/ server/ lib/: a Next
// App Router app with its code in app/ had both steps judge one module and read green.

const steps = (/** @type {string} */ out) => out.slice(out.indexOf("By hand"));

test("the graph and dead code read every source folder there is, app/ included", () => {
  const dir = tempRepo("roots-next", {
    "package.json": NEXT_PKG,
    "app/page.tsx": "export default function P() { return null; }\n",
    "src/lib/price.ts": "export const price = 1;\n",
    "components/card.tsx": "export const Card = () => null;\n",
  });
  const r = cli(["init", dir, "--stack", "next"], dir);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.match(pkg.scripts.graph, /^depcruise src app components --config/);
  assert.match(
    steps(r.out),
    /npx depcruise src app components --config \.dependency-cruiser\.cjs --baseline/,
  );
  const knip = readFileSync(join(dir, "knip.jsonc"), "utf8");
  for (const root of ["src", "app", "components"]) assert.ok(knip.includes(`"${root}/**/`), root);
  assert.doesNotMatch(knip, /"server\/\*\*/, "a folder that does not exist is not named");
});

test("a monorepo's graph reads its workspace folders, and knip keeps its own workspace reading", () => {
  const dir = tempRepo("roots-mono", {
    "package.json": JSON.stringify({ ...JSON.parse(NEXT_PKG), workspaces: ["apps/*"] }),
    "apps/web/app/page.tsx": "export default function P() { return null; }\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.match(pkg.scripts.graph, /^depcruise apps --config/);
  assert.match(
    readFileSync(join(dir, "knip.jsonc"), "utf8"),
    /"src\/\*\*\/\*\.\{js,jsx,mjs,cjs,ts,tsx\}"/,
  );
});

test("a client-only Vite app's graph names no server/ it does not have", () => {
  const dir = tempRepo("roots-vite", {
    "package.json": JSON.stringify({ name: "v", dependencies: { react: "19", vite: "6" } }),
    "src/main.tsx": "export const m = 1;\n",
  });
  cli(["init", dir, "--stack", "vite-react"], dir);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts.graph,
    "depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err",
  );
});

test("a root with no tsconfig.json gets a graph config that does not ask for one", () => {
  const dir = tempRepo("roots-notsconfig", {
    "package.json": JSON.stringify({ ...JSON.parse(NEXT_PKG), workspaces: ["apps/*"] }),
    "apps/web/app/page.tsx": "export default function P() { return null; }\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const config = readFileSync(join(dir, ".dependency-cruiser.cjs"), "utf8");
  assert.match(config, /\/\/ tsConfig: \{ fileName: "tsconfig\.json" \},/);
  const withTs = tempRepo("roots-tsconfig", { "package.json": NEXT_PKG, "tsconfig.json": "{}\n" });
  cli(["init", withTs, "--stack", "next"], withTs);
  assert.match(
    readFileSync(join(withTs, ".dependency-cruiser.cjs"), "utf8"),
    /^\s+tsConfig: \{ fileName/m,
  );
});

test("a config FlatCompat loads by name is not called an unused dependency", () => {
  const pkg = {
    ...JSON.parse(NEXT_PKG),
    devDependencies: { eslint: "9", "eslint-config-next": "15", "eslint-plugin-react": "7" },
  };
  const dir = tempRepo("roots-compat", {
    "package.json": JSON.stringify(pkg),
    "eslint.config.mjs":
      'const compat = new FlatCompat({});\nexport default [...compat.extends("next/core-web-vitals", "next/typescript", "plugin:react/recommended")];\n',
    "app/page.tsx": "export default function P() { return null; }\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const knip = readFileSync(join(dir, "knip.jsonc"), "utf8");
  assert.match(knip, /"ignoreDependencies": \["eslint-config-next", "eslint-plugin-react"\]/);
  assert.ok(knip.includes('"app/**/'), "the roots are still written");
});
