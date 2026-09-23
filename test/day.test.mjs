import { test } from "node:test";
import assert from "node:assert/strict";
import { dayRows, movedFindings, previousReading } from "../src/core/day.mjs";

/** A report with the fields the day's table reads. @param {Record<string, unknown>} over */
const reading = (over) =>
  /** @type {import("../src/core/report.mjs").Report} */ (
    /** @type {unknown} */ ({
      date: "2026-09-22",
      score: 70,
      phase: { id: "0", title: "", held: 10, applicable: 20 },
      enforced: { share: 60 },
      truth: { proven: 1, contradicted: 0, unproven: 2 },
      harness: { present: true, drift: 0, missing: 0 },
      bypass: { commits: 3, bypassed: 0, reasoned: 0, rate: 0 },
      floors: { raised: [] },
      findings: [
        { id: "A", status: "present" },
        { id: "B", status: "missing" },
        { id: "C", status: "present" },
      ],
      ...over,
    })
  );

test("each row says which way it moved, and a lower count of what is wrong is better", () => {
  const before = reading({});
  const now = reading({
    date: "2026-09-23",
    score: 72,
    truth: { proven: 1, contradicted: 1, unproven: 1 },
    findings: [
      { id: "A", status: "present" },
      { id: "B", status: "present" },
      { id: "C", status: "partial" },
    ],
  });
  const rows = Object.fromEntries(dayRows(now, before).map((r) => [r.label, r]));
  assert.deepEqual(rows.score, { label: "score", before: "70", now: "72", change: "better" });
  assert.equal(rows.missing?.change, "better", "one fewer missing");
  assert.equal(rows.partial?.change, "worse", "one more partial");
  assert.equal(rows.contradicted?.change, "worse");
  assert.equal(rows["bypassed commits"]?.change, "same", "unchanged is a row, not a silence");
});

test("the first reading has nothing to compare with, and says new rather than inventing a change", () => {
  const rows = dayRows(reading({}), null);
  assert.ok(rows.every((r) => r.change === "new" && r.before === "-"));
  assert.deepEqual(movedFindings(reading({}), null), []);
});

test("a check that moved is named, the ones that got worse first, so a flat score cannot hide them", () => {
  const before = reading({});
  const now = reading({
    findings: [
      { id: "A", status: "partial" },
      { id: "B", status: "present" },
      { id: "C", status: "waived" },
    ],
  });
  assert.deepEqual(movedFindings(now, before), [
    { id: "A", from: "present", to: "partial", change: "worse" },
    { id: "C", from: "present", to: "waived", change: "same" },
    { id: "B", from: "missing", to: "present", change: "better" },
  ]);
});

test("today's reading is compared with the newest one before today, never with itself", () => {
  const all = [
    reading({ date: "2026-09-20" }),
    reading({ date: "2026-09-22" }),
    reading({ date: "2026-09-23" }),
  ];
  assert.equal(previousReading(all, "2026-09-23")?.date, "2026-09-22");
  assert.equal(previousReading(all.slice(2), "2026-09-23"), null);
});
