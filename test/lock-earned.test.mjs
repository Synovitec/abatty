import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { lockEarned, writeBaseline } from "../src/ratchet/baseline.mjs";

// Lowering a floor by hand made leaving findings in simpler than removing them. A change that only
// lowered numbers has its floors written for it locally; CI, which judges what was pushed, never
// writes, and a change that raised anything writes nothing.

const REL = "scripts/ci/standards-baseline.json";
const LONG = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const floorOf = (/** @type {string} */ dir) =>
  JSON.parse(readFileSync(join(dir, REL), "utf8")).metrics["size.excessCode"];

/** A repository with a floor of 100 excess lines in one file. */
function withFloor() {
  const dir = tempRepo("lock-earned", {
    "package.json": JSON.stringify({ name: "x" }),
    "src/a.ts": LONG(400),
  });
  assert.equal(cli(["baseline", dir], dir).code, 0);
  assert.equal(floorOf(dir), 100);
  return dir;
}

test("a floor the change lowered is written for it, and the run asks for the commit", () => {
  const dir = withFloor();
  writeFileSync(join(dir, "src/a.ts"), LONG(350));
  const r = cli(["ratchet", dir], dir, { CI: "" });
  assert.equal(r.code, 3, "still refused: the lowered floor is not in the push yet");
  assert.match(r.out, /floor\(s\) locked where this change left them: size\.excessCode 100 → 50/);
  assert.match(r.out, /commit it with the change/);
  assert.equal(floorOf(dir), 50);
  assert.equal(cli(["ratchet", dir], dir, { CI: "" }).code, 0, "and green once it is written");
});

test("CI never writes the floor, and a change that raised anything writes nothing", () => {
  const dir = withFloor();
  writeFileSync(join(dir, "src/a.ts"), LONG(350));
  assert.equal(cli(["ratchet", dir], dir, { CI: "true" }).code, 3);
  assert.equal(floorOf(dir), 100, "CI judges what was pushed");
  writeFileSync(join(dir, "src/b.ts"), LONG(320));
  git(dir, "add", "-A");
  const raised = cli(["ratchet", dir], dir, { CI: "" });
  assert.equal(raised.code, 3);
  assert.doesNotMatch(raised.out, /locked where this change left them/);
  assert.equal(floorOf(dir), 100);
});

test("a rise on probation is not locked in with the floors that fell, and a skipped metric keeps its floor", () => {
  const dir = tempRepo("lock-probation", { "package.json": JSON.stringify({ name: "x" }) });
  const previous = /** @type {import("../src/ratchet/index.mjs").Baseline} */ (
    /** @type {unknown} */ ({
      metrics: { "size.excessCode": 100, "docs.danglingRefs": 0, "change.refactorTests": 0 },
      versions: { "change.refactorTests": 1 },
      hard: ["change.refactorTests"],
    })
  );
  const verdicts = /** @type {import("../src/ratchet/index.mjs").Verdict[]} */ (
    /** @type {unknown} */ ([
      { metric: "size.excessCode", status: "improved", value: 50, floor: 100 },
      { metric: "docs.danglingRefs", status: "probation", value: 3, floor: 0 },
    ])
  );
  const config = /** @type {import("../src/ratchet/index.mjs").RatchetConfig} */ (
    /** @type {unknown} */ ({ hard: [], ratchet: [] })
  );
  const base = { repoDir: dir, rel: REL, measurements: [], config, previous, today: "2026-09-24" };
  assert.deepEqual(
    lockEarned({ ...base, verdicts }).locked,
    [],
    "the probation rise holds it back",
  );
  const skipped = /** @type {import("../src/ratchet/index.mjs").Measurement[]} */ (
    /** @type {unknown} */ ([
      {
        metric: "change.refactorTests",
        value: 0,
        scanned: 0,
        debt: {},
        skipped: "no range",
        probe: { kind: "hard" },
      },
    ])
  );
  const written = writeBaseline({ ...base, measurements: skipped, dryRun: true });
  assert.equal(
    written.baseline.metrics["change.refactorTests"],
    0,
    "a metric this read skipped keeps its floor",
  );
});
