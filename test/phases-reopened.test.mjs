import { test } from "node:test";
import assert from "node:assert/strict";
import { reopened } from "../src/rules/phases.mjs";
import { phaseLine } from "../src/cli/status.mjs";

const ORDER = ["A.1", "0", "1", "2"];
/** @param {string} id @param {string} phase @param {string} status */
const finding = (id, phase, status) =>
  /** @type {import("../src/rules/index.mjs").Finding} */ (
    /** @type {unknown} */ ({ id, phase, status, level: "must", family: "Docs", title: id })
  );
const FINDINGS = [
  finding("DOC-ADR", "A.1", "missing"),
  finding("DOC-CONTEXT-SECTIONS", "A.1", "partial"),
  finding("DOC-CHANGELOG", "A.1", "present"),
  finding("DOC-WAIVED", "A.1", "waived"),
  finding("TEST-UNIT", "1", "missing"),
];
/** @param {...[unknown, string, string?]} phases id, status, updatedAt */
const state = (...phases) => ({
  phases: phases.map(([id, status, updatedAt]) => ({ id, status, updatedAt })),
});
const A1 = { id: "A.1" };

test("a phase the adoption closed, reopened by rules unmet now, names them and when it was closed", () => {
  const s = state([0, "done", "2026-09-20T12:00:00Z"], [2, "done", "2026-09-21T09:00:00Z"]);
  assert.deepEqual(reopened(A1, ORDER, s, FINDINGS), {
    closedAt: "2026-09-21",
    by: ["DOC-ADR", "DOC-CONTEXT-SECTIONS"],
  });
});

test("a phase past everything the adoption closed is where the work is, not reopened", () => {
  const s = state([0, "done", "2026-09-20T12:00:00Z"]);
  assert.equal(reopened({ id: "1" }, ORDER, s, FINDINGS), null);
});

test("without an adoption state, or with nothing done in it, no phase is reopened", () => {
  assert.equal(reopened(A1, ORDER, null, FINDINGS), null);
  assert.equal(reopened(A1, ORDER, { phases: "nope" }, FINDINGS), null);
  assert.equal(reopened(A1, ORDER, state([0, "in-progress"]), FINDINGS), null);
  assert.equal(reopened(null, ORDER, state([0, "done"]), FINDINGS), null);
});

test("the headline says a reopened phase is reopened, and says nothing more on a first adoption", () => {
  const r = {
    phase: { id: "A.1", title: "Day 0: the context file", held: 1, applicable: 3 },
    score: 80,
    applicable: 40,
    plan: ORDER.map((id) => ({ id })),
    findings: FINDINGS,
  };
  const adopted = phaseLine({ ...r, night: { state: state([2, "done", "2026-09-21"]) } });
  assert.match(adopted, /reopened: the adoption closed this phase by 2026-09-21; 2 rule\(s\)/);
  assert.match(adopted, /DOC-ADR, DOC-CONTEXT-SECTIONS/);
  assert.ok(!/reopened/.test(phaseLine({ ...r, night: { state: null } })));
});
