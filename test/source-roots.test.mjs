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
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "vite-react"], dir);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const config = readFileSync(join(dir, ".dependency-cruiser.cjs"), "utf8");
  assert.match(config, /\/\/ tsConfig: \{ fileName: "tsconfig\.json" \},/);
  const withTs = tempRepo("roots-tsconfig", { "package.json": NEXT_PKG, "tsconfig.json": "{}\n" });
  cli(["init", "--profile", "synovitec", withTs, "--stack", "next"], withTs);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const knip = readFileSync(join(dir, "knip.jsonc"), "utf8");
  assert.match(knip, /"ignoreDependencies": \["eslint-config-next", "eslint-plugin-react"\]/);
  assert.ok(knip.includes('"app/**/'), "the roots are still written");
});

test("an Astro site's dead-code project reads its .astro pages, and no lint script is written with nothing to run it", () => {
  // A component imported only from .astro pages read as unused, and `eslint .` was written into
  // a site with no eslint, so the gate's lint step could not run.
  const pkg = JSON.stringify({ name: "site", private: true, dependencies: { astro: "5" } });
  const dir = tempRepo("roots-astro", {
    "package.json": pkg,
    "src/pages/index.astro": "---\nimport Card from '../components/Card.astro';\n---\n<Card />\n",
    "src/components/Card.astro": "<div />\n",
  });
  cli(["init", "--profile", "synovitec", dir, "--stack", "astro"], dir);
  assert.match(
    readFileSync(join(dir, "knip.jsonc"), "utf8"),
    /"src\/\*\*\/\*\.\{[^}]*astro[^}]*\}"/,
  );
  const scripts = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts;
  assert.equal(scripts.lint, undefined);
  // the other direction: with eslint installed the script is written, and a Next app's knip
  // names no framework file it does not have
  const linted = tempRepo("roots-astro-eslint", {
    "package.json": JSON.stringify({
      name: "site",
      private: true,
      dependencies: { astro: "5" },
      devDependencies: { eslint: "9" },
    }),
    "src/pages/index.astro": "<div />\n",
  });
  cli(["init", "--profile", "synovitec", linted, "--stack", "astro"], linted);
  assert.match(
    JSON.parse(readFileSync(join(linted, "package.json"), "utf8")).scripts.lint,
    /eslint/,
  );
  const next = tempRepo("roots-next-ext", {
    "package.json": NEXT_PKG,
    "app/page.tsx": "export default 1;\n",
  });
  cli(["init", "--profile", "synovitec", next, "--stack", "next"], next);
  assert.doesNotMatch(readFileSync(join(next, "knip.jsonc"), "utf8"), /astro|svelte|vue/);
});
