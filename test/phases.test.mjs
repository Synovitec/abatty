import { test } from "node:test";
import assert from "node:assert/strict";
import { phaseOf, standing } from "../src/rules/phases.mjs";
import { todoOf } from "../src/core/gap-analysis.mjs";

const ORDER = ["A.1", "0", "1", "2"];
/**
 * @param {string} id @param {string} phase
 * @param {import("../src/rules/index.mjs").Status} status
 * @param {import("../src/rules/index.mjs").Level} [level]
 * @returns {import("../src/rules/index.mjs").Finding}
 */
const f = (id, phase, status, level = "must") => ({
  id,
  family: "X",
  rule: id,
  status,
  evidence: "",
  next: "",
  phase,
  level,
  enforcement: /** @type {import("../src/rules/index.mjs").Enforcement} */ ("hard"),
  standard: [],
});

test("a rule belongs to the earliest phase it names, and a phase the plan does not carry is unscheduled", () => {
  assert.equal(phaseOf("0", ORDER), "0");
  assert.equal(phaseOf("A.1", ORDER), "A.1");
  // "installed at 2, driven to target at 10": a repository owes it from the earliest of the two.
  assert.equal(phaseOf("2 / 10", ORDER), "2");
  assert.equal(phaseOf("A.1 / 0", ORDER), "A.1", "day 0 is before phase 0, not after it");
  assert.equal(phaseOf("0 / 11", ORDER), "0");
  assert.equal(phaseOf("-", ORDER), null);
  assert.equal(phaseOf("A.1 / status", ORDER), "A.1", "one name unknown, the other decides");
  assert.equal(phaseOf("status", ORDER), null);
});

test("the standing is per phase, and the current phase is the earliest with unfinished work", () => {
  const plan = [
    { id: "A.1", title: "day 0" },
    { id: "0", title: "the instrument" },
    { id: "1", title: "lint" },
    { id: "2", title: "coverage" },
  ];
  const findings = [
    f("a", "A.1", "present"),
    f("b", "A.1", "present"),
    f("c", "0", "present"),
    f("d", "0", "missing"),
    f("e", "1", "missing"),
    f("g", "-", "missing"),
    f("h", "2", "n/a"),
    f("i", "2", "waived"),
  ];
  const s = standing(findings, plan);
  assert.deepEqual(
    s.phases.map((p) => `${p.id}:${p.held}/${p.applicable}`),
    ["A.1:2/2", "0:1/2", "1:0/1"],
    "a phase whose rules are all n/a or waived is not in the plan this repository owes",
  );
  assert.equal(s.current?.id, "0", "A.1 is held, so the earliest unfinished phase is 0");
  assert.deepEqual(
    s.current?.unmet.map((u) => u.id),
    ["d"],
  );
  assert.equal(s.unscheduled.applicable, 1, "a rule the plan does not schedule is counted apart");

  // Everything held: no current phase, which the renderers read as the plan being complete.
  const done = standing([f("a", "A.1", "present"), f("c", "0", "present")], plan);
  assert.equal(done.current, null);
});

test("a young repository is not scored on the phases the plan puts after it", () => {
  // The whole point: six of one fresh application's missing rules were phase 0 and seventeen
  // were later phases. The headline must be the phase it is on, not a percentage of everything.
  const plan = [
    { id: "A.1", title: "day 0" },
    { id: "0", title: "the instrument" },
    { id: "10", title: "testing to target" },
  ];
  const findings = [
    f("a", "A.1", "present"),
    f("b", "A.1", "present"),
    f("c", "A.1", "missing"),
    ...Array.from({ length: 17 }, (_, i) => f(`later${i}`, "10", "missing")),
  ];
  const s = standing(findings, plan);
  assert.equal(s.current?.id, "A.1");
  assert.equal(s.current?.applicable, 3, "the denominator is day 0, not the whole catalog");
  assert.equal(s.current?.held, 2);
});

test("the next steps follow the plan's order, so day 0 is not listed behind phase 0", () => {
  // Reading the first number out of the phase made "A.1" sort as 1, which put the whole of
  // phase 0 ahead of the day-0 work that blocks it.
  const findings = [
    f("later", "0", "missing"),
    f("day0", "A.1", "missing"),
    f("nudge", "A.1", "missing", "should"),
    f("none", "-", "missing"),
  ];
  assert.deepEqual(
    todoOf(findings, ORDER).map((x) => x.id),
    ["day0", "nudge", "later", "none"],
    "day 0 first, then phase 0, and an unscheduled rule last",
  );
});
