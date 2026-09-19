/**
 * The bypass rate. What is measurable is narrower than "somebody typed the flag", and the
 * narrower thing is the honest one: a commit that broke a rule the hook enforces at commit time
 * cannot have passed through the hook, and that needs no cooperation from the machine that made
 * it - which is exactly the machine whose cooperation cannot be assumed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bypassReading, describeBypass } from "../src/core/bypass.mjs";

const commits = [
  { sha: "aaaaaaa1", subject: "feat: a thing" },
  { sha: "bbbbbbb2", subject: "fix: another" },
  { sha: "ccccccc3", subject: "chore: bypass, the registry was down: the gate ran by hand after" },
  { sha: "ddddddd4", subject: "docs: a note" },
];

test("a commit that got past the hook is counted; one that says why is not", () => {
  const r = bypassReading(commits, [
    { sha: "aaaaaaa1", detail: "src/a.mjs changed, CHANGELOG.md not touched after it" },
    { sha: "ccccccc3", detail: "src/b.mjs changed, CHANGELOG.md not touched after it" },
  ]);
  assert.equal(r.commits, 4);
  assert.deepEqual(
    r.bypassed.map((b) => b.sha),
    ["aaaaaaa1"],
    "the one with no reason",
  );
  assert.deepEqual(
    r.reasoned.map((b) => b.sha),
    ["ccccccc3"],
    "the reason is the difference between a decision and a habit",
  );
  assert.equal(r.rate, 25, "one of four");
  assert.match(describeBypass(r)[0] || "", /aaaaaaa · feat: a thing · src\/a\.mjs changed/);
});

test("a clean push reads zero, and an empty range invents nothing", () => {
  assert.deepEqual(bypassReading(commits, []), {
    commits: 4,
    bypassed: [],
    reasoned: [],
    rate: 0,
  });
  assert.deepEqual(bypassReading([], []), { commits: 0, bypassed: [], reasoned: [], rate: 0 });
  // A violation naming a commit outside the range is not this push's.
  assert.equal(bypassReading(commits, [{ sha: "eeeeeee5", detail: "x" }]).bypassed.length, 0);
});
