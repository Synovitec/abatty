/**
 * The bypass rate. What is measurable is narrower than "somebody typed the flag", and the
 * narrower thing is the honest one: a commit that broke a rule the hook enforces at commit time
 * cannot have passed through the hook, and that needs no cooperation from the machine that made
 * it - which is exactly the machine whose cooperation cannot be assumed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { bypassReading, describeBypass } from "../src/core/bypass.mjs";
import { buildReport } from "../src/core/report.mjs";

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

test("a no-changelog line is a decision on the record: the commit reads as reasoned, not as a hole", () => {
  const r = bypassReading(
    [
      { sha: "aaaaaaa1", subject: "fix: x" },
      { sha: "aaaaaaa2", subject: "fix: y\n\nno-changelog: the entry says it" },
    ],
    [
      { sha: "aaaaaaa1", detail: "d" },
      { sha: "aaaaaaa2", detail: "d" },
    ],
  );
  assert.equal(r.bypassed.length, 1);
  assert.equal(r.reasoned.length, 1);
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

test("the report reads the changelog pair from the config as the ratchet does: a source commit with its changelog line is not a bypass", async () => {
  // The raw config was handed to the pair builder, which reads `changelog` at the top level
  // while the config keeps it under `files`: the `then` side was null, and every source commit
  // of every push counted as a bypass, the ones that touched the changelog included (41 of 47
  // on this repository's own history). Both directions on one branch.
  const dir = tempRepo("bypass-pair", {
    "package.json": JSON.stringify({ name: "p", private: true, scripts: { test: "true" } }),
    "abatty.config.json": JSON.stringify({
      files: { changelog: "CHANGELOG.md" },
      changelogRequiredFor: ["src/"],
    }),
    "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
    "src/a.mjs": "export const a = 1;\n",
  });
  git(dir, "checkout", "-q", "-b", "feat/x");
  writeFileSync(join(dir, "src/a.mjs"), "export const a = 2;\n");
  writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n- a is 2\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a is 2");
  const clean = await buildReport(dir, { abattyVersion: "9.9.9", write: false, cache: false });
  assert.equal(clean.bypass.commits, 1);
  assert.equal(clean.bypass.bypassed, 0, "the changelog was touched in the same commit");

  writeFileSync(join(dir, "src/a.mjs"), "export const a = 3;\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a is 3, no changelog line");
  const holed = await buildReport(dir, { abattyVersion: "9.9.9", write: false, cache: false });
  assert.equal(holed.bypass.commits, 2);
  assert.equal(holed.bypass.bypassed, 1, "the second commit got past the hook");
  assert.equal(holed.bypass.rate, 50);
});
