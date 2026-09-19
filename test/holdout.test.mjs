/**
 * A night measured only on the rules it was told about is marking its own paper. A slice is
 * withheld from the instruction and the morning measures both; the gap is the number that means
 * something. These cases hold the split's determinism, its seeding, and the reading of the gap in
 * both directions - including the case where the slice is too small to read anything into, which
 * is where a number like this usually lies.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeGap, holdoutGap, splitSurface } from "../src/night/holdout.mjs";

const ids = Array.from({ length: 40 }, (_, i) => `RULE-${String(i).padStart(2, "0")}`);

test("the split is deterministic, seeded, and covers every rule exactly once", () => {
  const a = splitSurface(ids, "2026-09-19");
  const b = splitSurface(ids, "2026-09-19");
  assert.deepEqual(a, b, "two readings of one night agree");
  assert.equal(a.visible.length + a.withheld.length, ids.length);
  assert.deepEqual([...a.visible, ...a.withheld].sort(), [...ids].sort(), "nothing is lost");
  assert.equal(a.withheld.length, 6, "about fifteen per cent of forty");

  // A different night withholds a different slice: a repository cannot settle into passing the
  // visible ones forever.
  const later = splitSurface(ids, "2026-10-01");
  assert.notDeepEqual(later.withheld, a.withheld);
});

test("the gap reads the difference between the two sides, and n/a counts on neither", () => {
  const split = { visible: ["A", "B", "C", "D"], withheld: ["E", "F", "G", "H"] };
  // The work followed the list: everything visible holds, nothing withheld does.
  const fitted = holdoutGap(
    [
      { id: "A", status: "present" },
      { id: "B", status: "present" },
      { id: "C", status: "present" },
      { id: "D", status: "present" },
      { id: "E", status: "missing" },
      { id: "F", status: "missing" },
      { id: "G", status: "missing" },
      { id: "H", status: "missing" },
    ],
    split,
  );
  assert.equal(fitted.visible.pct, 100);
  assert.equal(fitted.withheld.pct, 0);
  assert.equal(fitted.gap, 100);
  assert.match(describeGap(fitted), /followed the list rather than the standard/);

  // The work followed the standard: both sides move together and the gap says nothing alarming.
  const general = holdoutGap(
    [
      { id: "A", status: "present" },
      { id: "B", status: "present" },
      { id: "C", status: "missing" },
      { id: "D", status: "present" },
      { id: "E", status: "present" },
      { id: "F", status: "present" },
      { id: "G", status: "missing" },
      { id: "H", status: "present" },
    ],
    split,
  );
  assert.equal(general.gap, 0);
  assert.equal(/followed the list/.test(describeGap(general)), false);

  // A rule that does not apply is counted on neither side: a night is not credited or blamed for
  // a rule that was never its subject.
  const withNa = holdoutGap(
    [
      { id: "A", status: "present" },
      { id: "B", status: "n/a" },
      { id: "C", status: "n/a" },
      { id: "D", status: "waived" },
      { id: "E", status: "present" },
      { id: "F", status: "n/a" },
      { id: "G", status: "n/a" },
      { id: "H", status: "n/a" },
    ],
    split,
  );
  assert.equal(withNa.visible.judged, 1);
  assert.equal(withNa.withheld.judged, 1);
  assert.match(describeGap(withNa), /too few withheld rules to read anything into/);
});
