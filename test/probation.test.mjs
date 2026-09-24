import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, compare, failed } from "../src/ratchet/index.mjs";

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
