import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { PACKS, detectPacks, toolOf } from "../src/packs/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { detectPreset, presetById } from "../src/presets/index.mjs";
import { runStepControls } from "../src/core/step-controls.mjs";

const PY = {
  "pyproject.toml":
    '[project]\nname = "svc"\n\n[tool.ruff]\nline-length = 100\n\n[tool.mypy]\nstrict = true\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n',
  "src/app.py": "def main() -> int:\n    return 0\n",
  "tests/test_app.py": "def test_main():\n    assert True\n",
};
/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);

test("packs are detected from the tree, and a tool is found by config, script or dependency; a pyproject section counts, the bare file does not", () => {
  assert.deepEqual(
    PACKS.map((p) => p.id),
    ["javascript", "python"],
  );
  const py = tempRepo("packs-py", PY);
  const c = buildContext(py);
  assert.deepEqual(
    c.packs.map((p) => p.id),
    ["python"],
  );
  assert.deepEqual(c.sourceFiles, ["src/app.py"], "the test file is not a source");
  assert.equal(c.stack.python, true);
  assert.equal(c.stack.js, false);
  assert.equal(c.stack.docsOnly, false);
  const pack = c.packs[0];
  assert.ok(pack);
  assert.equal(toolOf(c, pack, "linter").evidence, "pyproject.toml");
  assert.equal(toolOf(c, pack, "typecheck").evidence, "pyproject.toml");
  assert.equal(toolOf(c, pack, "dead").present, false, "no [tool.vulture] section");
  assert.equal(toolOf(c, pack, "test").evidence, "pyproject.toml");
  const both = tempRepo("packs-both", {
    ...PY,
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
    "eslint.config.mjs": "export default [];\n",
  });
  assert.deepEqual(
    detectPacks(buildContext(both).files).map((p) => p.id),
    ["javascript", "python"],
  );
});

test("the rules keep the same words: the linter, the formatter, the typecheck and the tests read per pack; a JavaScript-only rule is n/a on Python", () => {
  const py = tempRepo("packs-rules", PY);
  const f = runCatalog(buildContext(py), RULES);
  assert.equal(of(f, "CODE-ESLINT").status, "present");
  assert.equal(of(f, "CODE-ESLINT").evidence, "python: pyproject.toml");
  assert.equal(of(f, "TYPES-SCRIPT").status, "present");
  assert.equal(of(f, "TEST-UNIT").status, "present");
  assert.match(of(f, "TEST-UNIT").evidence, /python: pyproject\.toml, 1 test file\(s\)/);
  assert.equal(of(f, "CODE-DEADCODE").status, "missing");
  assert.equal(of(f, "CODE-DEADCODE").evidence, "python: no vulture");
  assert.equal(of(f, "CODE-FORMAT").status, "partial", "the section, no format script");
  assert.equal(of(f, "CODE-SHAPE").status, "n/a");
  assert.match(of(f, "CODE-SHAPE").evidence, /no JavaScript or TypeScript sources/);
  assert.equal(of(f, "CODE-SIZE-800").status, "n/a");
  const both = tempRepo("packs-rules-both", {
    ...PY,
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const g = runCatalog(buildContext(both), RULES);
  assert.equal(of(g, "CODE-ESLINT").status, "partial");
  assert.equal(of(g, "CODE-ESLINT").evidence, "javascript: no eslint; python: pyproject.toml");
  assert.equal(of(g, "CODE-SHAPE").status, "missing", "the JavaScript rule applies again");
});

test("the python preset: detected from the tree, init writes the private package and the config, the gate reaches the first command; the controls skip a tool that is not installed", () => {
  const py = tempRepo("packs-preset", PY);
  assert.equal(detectPreset(new Set(), buildContext(py).files)?.id, "python");
  assert.equal(detectPreset(new Set()), null, "never from npm dependencies");
  const init = cli(["init", py], py);
  assert.equal(init.code, 0, init.out);
  assert.match(init.out, /Python \(ruff, mypy, pytest\)/);
  assert.match(init.out, /not yet proven/);
  const cfg = JSON.parse(readFileSync(join(py, "abatty.config.json"), "utf8"));
  assert.equal(cfg.stack, "python");
  assert.deepEqual(cfg.lintExtensions, [".py"]);
  assert.equal(cfg.commands.lintFile, "ruff check");
  const pkg = JSON.parse(readFileSync(join(py, "package.json"), "utf8"));
  assert.equal(pkg.scripts.gate, "abatty gate");
  git(py, "add", "-A");
  git(py, "commit", "-q", "-m", "chore: the instrument");
  const gate = cli(["gate", py, "--fast"], py);
  assert.equal(gate.code, 1, gate.out);
  // With the tools installed the strict typecheck refuses the unannotated test; without them
  // the first command fails on "not found". Either way the gate is red at a command step.
  assert.match(
    gate.out,
    /(format|lint \(CODE\.4\)|typecheck \(CODE\.3\)|dead code \(CODE\.6\)|unit tests \(TEST\.1\)) failed/,
  );
  const preset = presetById("python");
  assert.ok(preset);
  const controls = runStepControls({ repoDir: py, preset, run: () => 1 });
  const by = Object.fromEntries(controls.steps.map((s) => [s.label.replace(/ \(.*/, ""), s]));
  // A tool that is installed goes red on its control; one that is not is skipped, said.
  assert.ok(["skipped", "red"].includes(by["format"]?.outcome || ""), JSON.stringify(by["format"]));
  if (by["format"]?.outcome === "skipped")
    assert.match(by["format"].detail, /not installed \(ruff\)/);
  assert.ok(
    controls.steps.every((s) => s.outcome !== "green"),
    "no step stays green on its control: " + JSON.stringify(controls.steps),
  );
  assert.equal(
    by["abatty ratchet + changelog range"]?.outcome,
    "red",
    "the ratchet on an 801-line .py file",
  );
  assert.equal(by["secret scan"]?.outcome, "red");
  assert.deepEqual(controls.absent, []);
});
