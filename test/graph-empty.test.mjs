import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";

// dependency-cruiser exits 0 when it reads no module at all. With TypeScript 7 installed it read
// none of a Next app's .ts files, said "(0 modules, 0 dependencies cruised)", and the import
// graph step read green over a repository it had not judged.

const EMPTY = "✔ no dependency violations found (0 modules, 0 dependencies cruised)\n";
const READ = "✔ no dependency violations found (12 modules, 30 dependencies cruised)\n";

const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (
  /** @type {unknown} */ ({
    id: "graph",
    gate: { always: [{ label: "import graph (CODE.5)", script: "graph" }], suites: [] },
  })
);

/** A gate whose graph step printed `said`. @param {string} dir @param {string} said */
const gate = (dir, said) =>
  runGate({
    repoDir: dir,
    preset,
    log: () => {},
    run: (_cwd, _script, _args, _env, o) => {
      if (o?.log) {
        mkdirSync(dirname(o.log), { recursive: true });
        writeFileSync(o.log, said);
      }
      return 0;
    },
  });

const scripts = { "package.json": JSON.stringify({ scripts: { graph: "depcruise src" } }) };

test("a graph step that cruised 0 modules where there are scripts could not run, and stops the gate", () => {
  const dir = tempRepo("graph-empty", { ...scripts, "src/a.ts": "export const a = 1;\n" });
  const r = gate(dir, EMPTY);
  assert.equal(r.ok, false);
  assert.equal(r.errored, true, "the instrument, not the work");
  const step = r.events.find((e) => e.label === "import graph (CODE.5)");
  assert.equal(step?.outcome, "errored");
  assert.match(String(step?.detail), /cruised 0 modules in a repository with 1 tracked script/);
});

test("a graph step that read modules, or a repository with no script to read, stays green", () => {
  const dir = tempRepo("graph-read", { ...scripts, "src/a.ts": "export const a = 1;\n" });
  assert.equal(gate(dir, READ).ok, true);
  const docs = tempRepo("graph-docs", { ...scripts, "README.md": "# docs\n" });
  assert.equal(gate(docs, EMPTY).ok, true, "nothing to read is not a broken reader");
});
