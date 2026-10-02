import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";

// `tsc --noEmit` with no tsconfig.json prints its help screen and exits 1. The gate called that a
// typecheck that failed: the work judged red by a compiler that had nothing to check.

const HELP =
  "Version 6.0.3\ntsc: The TypeScript Compiler - Version 6.0.3\n\nCOMMON COMMANDS\n\n  tsc\n";
const TYPE_ERROR =
  "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n";

const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (
  /** @type {unknown} */ ({
    id: "tsc",
    gate: { always: [{ label: "typecheck (CODE.3)", script: "typecheck" }], suites: [] },
  })
);

/** A gate whose typecheck printed `said` and exited 1. @param {string} said */
function gate(said) {
  const dir = tempRepo("tsc-help", {
    "package.json": JSON.stringify({ scripts: { typecheck: "tsc --noEmit" } }),
  });
  return runGate({
    repoDir: dir,
    preset,
    log: () => {},
    run: (_cwd, _script, _args, _env, o) => {
      if (o?.log) {
        mkdirSync(dirname(o.log), { recursive: true });
        writeFileSync(o.log, said);
      }
      return 1;
    },
  });
}

test("tsc's help screen is a typecheck that could not run, and says the tsconfig is missing", () => {
  const r = gate(HELP);
  assert.equal(r.errored, true, "the instrument, not the work");
  const step = r.events.find((e) => e.label === "typecheck (CODE.3)");
  assert.equal(step?.outcome, "errored");
  assert.match(String(step?.detail), /found no tsconfig\.json/);
});

test("a typecheck that reported a type error still failed: the work, judged", () => {
  const r = gate(TYPE_ERROR);
  assert.equal(r.errored, false);
  assert.equal(r.events.find((e) => e.label === "typecheck (CODE.3)")?.outcome, "failed");
});
