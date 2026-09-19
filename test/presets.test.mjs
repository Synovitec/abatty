import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { detectPreset, presetById } from "../src/presets/index.mjs";

// A fixture repository per preset: init, the detection from the dependencies alone where the
// preset has any, measure, doctor's drift and the gate's skeleton (every step skipped, green or
// stopped on a tool that is not installed).
//
// A fixture is NOT a proof. A preset stays unproven until a named repository has run it and a
// date says when; what the fixture proves is narrower and still worth having, which is that the
// package does not break on the shape. Every preset the package ships has one, because the three
// that no repository has run are exactly the three where nothing else would catch a break.
/** @type {Record<string, { pkg?: { dependencies?: Record<string, string>, devDependencies?: Record<string, string>, [k: string]: unknown }, files: Record<string, string>, rule?: string, expect?: string[], noJs?: boolean, gate?: RegExp }>} */
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
  next: {
    pkg: {
      name: "fixture-next",
      version: "0.1.0",
      private: true,
      scripts: { test: "node -e process.exit(0)", build: "next build", dev: "next dev" },
      dependencies: { next: "15.0.0", react: "19.0.0", "react-dom": "19.0.0" },
      devDependencies: { typescript: "5.6.0" },
    },
    files: {
      "app/page.tsx": "export default function Page() { return null; }\n",
      "app/layout.tsx": "export default function Layout() { return null; }\n",
      "next.config.mjs": "export default {};\n",
    },
    rule: "a11y.md",
  },
  // The two presets that are not JavaScript at all: `init` writes them a private package.json
  // so `npm run gate` and the hooks work, and no dependency-cruiser or knip config, because
  // neither tool has anything to read. The gate's shape differs, so each says what it expects.
  python: {
    files: {
      "pyproject.toml": '[project]\nname = "fixture"\nversion = "0.1.0"\n',
      "src/app.py": "def main():\n    return 1\n",
      "tests/test_app.py": "def test_main():\n    assert True\n",
    },
    noJs: true,
    expect: [".claude/settings.json", "abatty.config.json", ".githooks/pre-push", "CLAUDE.md"],
    gate: /format/,
  },
  docs: {
    files: {
      "docs/README.md": '---\ntitle: "Index"\n---\n\n# Index\n',
      "README.md": "# Fixture\n",
    },
    noJs: true,
    expect: [".claude/settings.json", "abatty.config.json", ".githooks/pre-push", "CLAUDE.md"],
    gate: /format|ratchet/,
  },
};

for (const [id, fx] of Object.entries(FIXTURES)) {
  test(`preset ${id}: ${fx.pkg ? "detected from the dependencies" : "chosen by --stack"}; init, measure, doctor and the gate skeleton work on its fixture`, () => {
    const dir = tempRepo(`preset-${id}`, {
      ...(fx.pkg ? { "package.json": JSON.stringify(fx.pkg, null, 2) + "\n" } : {}),
      ...fx.files,
    });
    // A preset with dependencies is detected from them alone; python and docs have none, and
    // are chosen by `--stack`, which is what the flag below exercises.
    if (fx.pkg)
      assert.equal(
        detectPreset(
          new Set([
            ...Object.keys(fx.pkg.dependencies || {}),
            ...Object.keys(fx.pkg.devDependencies || {}),
          ]),
        )?.id,
        id,
      );
    const init = fx.noJs ? cli(["init", dir, "--stack", id], dir) : cli(["init", dir], dir);
    // The next steps are what THIS init wrote. A preset with no import graph must not send its
    // reader looking for a dependency-cruiser config it has no copy of.
    assert.equal(
      /dependency-cruiser\.cjs: one rule per arrow/.test(init.out),
      !fx.noJs,
      `${id}: the next steps name a file this preset ${fx.noJs ? "does not write" : "writes"}`,
    );
    assert.equal(init.code, 0, init.out);
    assert.match(init.out, presetById(id)?.proven ? /proven by/ : /not yet proven by a repository/);
    for (const f of fx.expect || [
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
    if (fx.gate) assert.match(gate.out, fx.gate, `${id}: ${gate.out}`);
    else {
      // The preset names its linter and never installs it, so on a machine that happens to have
      // one the step fails and on a clean one it cannot run. Rather than accept either answer,
      // the fixture's lint script is replaced with one whose outcome is the same everywhere: it
      // runs, and it fails. What the test is about - the skeleton reaches lint and stops there -
      // is unchanged, and the exit code is exact again.
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      pkg.scripts.lint = "node -e 'process.exit(1)'";
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
      const exact = cli(["gate", dir, "--fast"], dir);
      assert.equal(exact.code, 3, exact.out);
      assert.match(exact.out, /skipped format/);
      assert.match(exact.out, /✗ lint \(CODE\.4\)/);
    }
  });
}
