import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { detectPreset, presetById } from "../src/presets/index.mjs";

// Fixture repositories for the presets no client has run yet: init, the detection from the
// dependencies alone, measure, doctor's drift and the gate's skeleton (every step skipped or
// green on a fresh repository). A preset stays "unproven" until a repository ran it; the
// fixture proves the package does not break on the shape.
/** @type {Record<string, { pkg: { dependencies: Record<string, string>, devDependencies?: Record<string, string>, [k: string]: unknown }, files: Record<string, string>, rule: string }>} */
const FIXTURES = {
  "vite-react": {
    pkg: {
      name: "fixture-vite",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", build: "node -e process.exit(0)" },
      dependencies: { react: "19.0.0", "react-dom": "19.0.0" },
      devDependencies: { vite: "6.0.0", "@vitejs/plugin-react": "4.3.0" },
    },
    files: {
      "src/App.tsx": "export function App() { return null; }\n",
      "src/main.tsx": "import { App } from './App';\nApp();\n",
    },
    rule: "a11y.md",
  },
  astro: {
    pkg: {
      name: "fixture-astro",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", build: "astro build", dev: "astro dev" },
      dependencies: { astro: "5.0.0" },
      devDependencies: { "@astrojs/check": "0.9.0", typescript: "5.6.0" },
    },
    files: {
      "src/pages/index.astro": "---\nconst title = 'Home';\n---\n<h1>{title}</h1>\n",
      "src/layouts/Base.astro": "---\n---\n<html><body><slot /></body></html>\n",
      "src/components/Hello.ts": "export const hello = () => 'hello';\n",
      "astro.config.mjs": "export default {};\n",
    },
    rule: "i18n.md",
  },
  node: {
    pkg: {
      name: "fixture-node",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", start: "node src/server.mjs" },
      dependencies: { express: "5.0.0" },
    },
    files: { "src/server.mjs": "export const app = () => 1;\n" },
    rule: "testing.md",
  },
};

for (const [id, fx] of Object.entries(FIXTURES)) {
  test(`preset ${id}: detected from the dependencies; init, measure, doctor and the gate skeleton work on its fixture`, () => {
    const dir = tempRepo(`preset-${id}`, {
      "package.json": JSON.stringify(fx.pkg, null, 2) + "\n",
      ...fx.files,
    });
    assert.equal(
      detectPreset(
        new Set([
          ...Object.keys(fx.pkg.dependencies),
          ...Object.keys(fx.pkg.devDependencies || {}),
        ]),
      )?.id,
      id,
    );
    const init = cli(["init", dir], dir);
    assert.equal(init.code, 0, init.out);
    assert.match(init.out, presetById(id)?.proven ? /proven by/ : /not yet proven by a repository/);
    for (const f of [
      ".claude/settings.json",
      "abatty.config.json",
      ".claude/hooks/guard.mjs",
      `.claude/rules/${fx.rule}`,
      ".dependency-cruiser.cjs",
      "knip.jsonc",
      ".githooks/pre-push",
      "CLAUDE.md",
    ])
      assert.ok(existsSync(join(dir, f)), `${id}: missing ${f}`);
    assert.equal(JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8")).stack, id);
    const measure = cli(["measure", dir, "--quiet"], dir);
    assert.equal(measure.code, 0, measure.out);
    assert.match(measure.out, /Score \d+\/100 over \d+ applicable checks/);
    const doctor = cli(["doctor", dir, "--skip-self-test"], dir);
    assert.match(doctor.out, /drift: 0 file\(s\) differ/);
    // The dependencies are named, never installed: the gate skips the format step (no Prettier
    // config yet), reaches lint, and stops there naming the step - the skeleton holds its order.
    const gate = cli(["gate", dir, "--fast"], dir);
    assert.equal(gate.code, 1, gate.out);
    assert.match(gate.out, /skipped format/);
    assert.match(gate.out, /lint \(CODE-4\) failed/);
  });
}
