import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";

// `node --test` with no test file exits 0 and prints "# tests 0", and the unit step read green
// having judged nothing. It now stays green and says it ran no test.

const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (
  /** @type {unknown} */ ({
    id: "u",
    gate: { always: [{ label: "unit tests (TEST.1)", script: "test" }], suites: [] },
  })
);

/** @param {string} said */
function gate(said) {
  const dir = tempRepo("no-tests", {
    "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
  });
  /** @type {string[]} */
  const lines = [];
  const r = runGate({
    repoDir: dir,
    preset,
    log: (l) => lines.push(l),
    run: (_c, _s, _a, _e, o) => {
      if (o?.log) {
        mkdirSync(dirname(o.log), { recursive: true });
        writeFileSync(o.log, said);
      }
      return 0;
    },
  });
  return { r, lines: lines.join("\n") };
}

test("a unit step that ran no test says so, and stays a pass", () => {
  const { r, lines } = gate("# tests 0\n# suites 0\n# pass 0\n# fail 0\n");
  assert.equal(r.ok, true);
  assert.equal(r.events[0]?.detail, "ran no test");
  assert.match(lines, /passed and ran no test \(node --test found none\)/);
});

test("a unit step that ran tests is not marked", () => {
  const { r } = gate("# tests 12\n# pass 12\n# fail 0\n");
  assert.equal(r.events[0]?.detail, undefined);
});
