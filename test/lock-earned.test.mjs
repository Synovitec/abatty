import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";

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
