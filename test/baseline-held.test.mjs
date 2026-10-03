import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import {
  BUILTIN_PROBES,
  DEFAULT_CONFIG,
  compare,
  failed,
  measureAll,
  writeBaseline,
} from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// A design repository's first baseline was refused outright because one HARD metric (six old
// dates sliced off UTC instants) read above zero, and with it every other floor: a gate that
// could never go green. At the first baseline, debt already there on a HARD metric is held as a
// ratchet until it reaches zero; every later write keeps the old refusal.

const PROBES = BUILTIN_PROBES.filter((p) => !p.optIn);
const DAY = (/** @type {string} */ name) =>
  `export const ${name} = (d) => new Date(d).toISOString()` + ".slice(0, 10);\n";
const PKG = JSON.stringify({ name: "fixture", version: "0.1.0" }) + "\n";

/** @param {string} dir @param {any} baseline */
const measure = (dir, baseline) =>
  measureAll(PROBES, buildContext(dir), { config: DEFAULT_CONFIG, range: "" }, baseline);
/** @param {string} dir @param {any} previous */
const write = (dir, previous) =>
  writeBaseline({
    repoDir: dir,
    rel: "scripts/ci/standards-baseline.json",
    measurements: measure(dir, previous),
    config: DEFAULT_CONFIG,
    previous,
    today: "2026-10-03",
  });
const verdict = (/** @type {string} */ dir, /** @type {any} */ b) =>
  compare(measure(dir, b), b, DEFAULT_CONFIG).find((v) => v.metric === "valid.utcDay");

test("the first baseline holds a HARD metric's existing debt as a ratchet, and the gate holds it there", () => {
  const dir = tempRepo("held-first", { "package.json": PKG, "src/a.ts": DAY("a") });
  const first = write(dir, null);
  assert.equal(first.ok, true, first.refusals.join("; "));
  assert.deepEqual(first.baseline.held, ["valid.utcDay"]);
  assert.equal(first.baseline.metrics["valid.utcDay"], 1);
  assert.equal(verdict(dir, first.baseline)?.status, "ok", "the debt it was given does not fail");
  // A rise is a rise: held is a ratchet, not a pass.
  writeFileSync(join(dir, "src/b.ts"), DAY("b"));
  const v = verdict(dir, first.baseline);
  assert.equal(v?.status, "regressed");
  assert.equal(failed([/** @type {any} */ (v)]), true);
});

test("held ends at zero, where the metric becomes HARD; a later write never holds new debt", () => {
  const dir = tempRepo("held-later", { "package.json": PKG, "src/a.ts": DAY("a") });
  const first = write(dir, null);
  writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
  const zero = write(dir, first.baseline);
  assert.equal(zero.ok, true, zero.refusals.join("; "));
  assert.deepEqual(zero.baseline.held, []);
  assert.ok(zero.baseline.hard?.includes("valid.utcDay"), "HARD from here");
  assert.ok(zero.promoted.includes("valid.utcDay"));
  // The other direction: a repository that already had a baseline gains no held metric.
  writeFileSync(join(dir, "src/a.ts"), DAY("a"));
  const later = write(dir, zero.baseline);
  assert.equal(later.ok, false);
  assert.match(later.refusals.join(" "), /valid\.utcDay is HARD and reads 1/);
});
