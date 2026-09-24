import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import {
  BUILTIN_PROBES,
  DEFAULT_CONFIG,
  measureAll,
  readBaseline,
  writeBaseline,
} from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// An adopter's baseline write carried a metric whose total fell (30109 → 30072) while ten files'
// floors rose, and nothing in the record said so: a fall anywhere could hide a rise anywhere else.

const LONG = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const REL = "scripts/ci/standards-baseline.json";
const probes = BUILTIN_PROBES.filter((p) => p.metric === "size.excessCode");
// Held as a ratchet, as an adopter holds a metric it is burning down.
const config = { ...DEFAULT_CONFIG, ratchet: ["size.excessCode"] };

/** @param {string} dir @param {object} [extra] */
function write(dir, extra = {}) {
  const previous = readBaseline(dir, REL);
  return writeBaseline({
    repoDir: dir,
    rel: REL,
    measurements: measureAll(
      probes,
      buildContext(dir, { tracked: true }),
      { config, range: "" },
      previous,
    ),
    config,
    previous,
    today: "2026-09-24",
    ...extra,
  });
}

test("a file whose floor rose is a rise even when the metric's total fell, and it is recorded", () => {
  const dir = tempRepo("baseline-files", { "src/a.ts": LONG(400), "src/b.ts": LONG(400) });
  assert.equal(write(dir).ok, true);
  writeFileSync(join(dir, "src/a.ts"), LONG(340));
  writeFileSync(join(dir, "src/b.ts"), LONG(410));
  const refused = write(dir);
  assert.equal(refused.ok, false, "the total fell by 50 and b rose by 10");
  assert.match(refused.refusals.join("\n"), /size\.excessCode src\/b\.ts 100 → 110/);
  const recorded = write(dir, { reason: "b absorbs a split, trimmed next", owner: "platform" });
  assert.equal(recorded.ok, true);
  const entry = readBaseline(dir, REL)?.entries?.["size.excessCode src/b.ts"];
  assert.deepEqual(
    { was: entry?.was, now: entry?.now, owner: entry?.owner },
    { was: 100, now: 110, owner: "platform" },
  );
  assert.equal(readBaseline(dir, REL)?.entries?.["size.excessCode src/a.ts"], undefined, "a fell");
});
