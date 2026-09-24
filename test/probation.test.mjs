import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, compare, failed, writeBaseline } from "../src/ratchet/index.mjs";
import { sarifOfVerdicts } from "../src/ui/sarif.mjs";

// A blocking check lives on its false positives. A probe on probation is measured and shown, and
// never fails a run until a named repository has run it clean.

/**
 * @param {boolean} probation @param {number} value
 * @returns {import("../src/ratchet/index.mjs").Measurement}
 */
function measured(probation, value) {
  return {
    metric: "x.new",
    kind: /** @type {const} */ ("ratchet"),
    value,
    scanned: 3,
    findings: Array.from({ length: value }, (_, i) => ({ path: "src/a.ts", line: i + 1 })),
    debt: /** @type {Record<string, number>} */ (value ? { "src/a.ts": value } : {}),
    probe: /** @type {any} */ ({ metric: "x.new", kind: "ratchet", probation, controls: [] }),
  };
}

const floor = {
  measuredAt: "2026-09-24",
  metrics: { "x.new": 1 },
  debt: { "x.new": { "src/a.ts": 1 } },
};

test("a probe on probation that would fail reads probation, keeps its findings and fails nothing", () => {
  const [rose] = compare([measured(true, 3)], floor, DEFAULT_CONFIG);
  assert.equal(rose?.status, "probation");
  assert.equal(rose?.findings.length, 3);
  assert.match(rose?.messages.join("\n") || "", /would read regressed/);
  assert.equal(failed(rose ? [rose] : []), false);
  const [unfloored] = compare([measured(true, 2)], null, DEFAULT_CONFIG);
  assert.equal(unfloored?.status, "probation");
});

test("a probe on probation that holds reads ok, and one off probation fails the same numbers", () => {
  assert.equal(compare([measured(true, 1)], floor, DEFAULT_CONFIG)[0]?.status, "ok");
  const [blocking] = compare([measured(false, 3)], floor, DEFAULT_CONFIG);
  assert.equal(blocking?.status, "regressed");
  assert.equal(failed(blocking ? [blocking] : []), true);
});

test("a probe on probation is never promoted to HARD, so a later finding cannot refuse the baseline", () => {
  const write = (/** @type {number} */ value, /** @type {any} */ previous) =>
    writeBaseline({
      repoDir: ".",
      rel: "unused.json",
      measurements: [measured(true, value)],
      config: DEFAULT_CONFIG,
      previous,
      today: "2026-09-24",
      dryRun: true,
    });
  const zero = write(0, null);
  assert.equal(zero.ok, true);
  assert.deepEqual(zero.baseline.hard, [], "zero is recorded, not promoted");
  const later = write(2, zero.baseline);
  assert.equal(later.ok, true, later.refusals.join("; "));
  assert.equal(later.baseline.metrics["x.new"], 2);
  // A floor written while the probe was promoted by an older release does not bind it either.
  assert.equal(write(2, { ...zero.baseline, hard: ["x.new"] }).ok, true);
});

test("a probe on probation is a SARIF note, never an error a forge fails a check on", () => {
  const [v] = compare([measured(true, 3)], floor, DEFAULT_CONFIG);
  const log = sarifOfVerdicts({
    verdicts: v ? [v] : [],
    probes: [measured(true, 0).probe],
    version: "0",
  });
  const levels = (log.runs[0]?.results || []).map((/** @type {any} */ r) => r.level);
  assert.deepEqual([...new Set(levels)], ["note"]);
});

test("after a redefinition the next baseline records the new number without calling it a rise", () => {
  const m = measured(false, 3);
  m.probe = { ...m.probe, version: 2 };
  const previous = { ...floor, versions: { "x.new": 1 } };
  const o = {
    repoDir: ".",
    rel: "unused.json",
    config: DEFAULT_CONFIG,
    today: "2026-09-24",
    dryRun: true,
  };
  assert.equal(writeBaseline({ ...o, measurements: [m], previous }).ok, true);
  // Under the same definition the same numbers are a rise that needs a reason.
  assert.equal(
    writeBaseline({ ...o, measurements: [measured(false, 3)], previous: floor }).ok,
    false,
  );
});
