import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { CAVEATS, SAMPLE_FLOOR, fixHistory, probeAgainstHistory } from "../src/core/validate.mjs";

/**
 * A history: every file with the same churn, and the named ones touched by a fixing commit.
 * @param {string[]} files @param {string[]} fixedFiles
 */
function history(files, fixedFiles) {
  return {
    commits: 50,
    fixes: fixedFiles.length,
    churn: new Map(files.map((f) => [f, 3])),
    fixed: new Map(fixedFiles.map((f) => [f, 1])),
  };
}

/** @param {string} prefix @param {number} n */
const files = (prefix, n) => Array.from({ length: n }, (_, i) => `src/${prefix}${i}.ts`);

test("a fixing commit is read from its subject, in the conventional form and in plain words", () => {
  const dir = tempRepo("validate-history", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export {};\n",
  });
  const commit = (/** @type {string} */ msg, /** @type {string} */ file) => {
    writeFileSync(join(dir, file), `export const x = ${Math.random()};\n`);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", msg);
  };
  commit("feat: a feature", "src/a.ts");
  commit("fix: a conventional fix", "src/a.ts");
  commit("repair the broken thing", "src/b.ts");
  commit("chore: tidy", "src/c.ts");

  const h = fixHistory((...a) => git(dir, ...a), "");
  assert.equal(h.fixes, 2, "the conventional one and the one that says broken");
  assert.equal(h.fixed.get("src/a.ts"), 1);
  assert.equal(h.fixed.get("src/b.ts"), 1);
  assert.equal(h.fixed.has("src/c.ts"), false, "a chore is not a fix");
  assert.equal(
    h.churn.get("src/a.ts"),
    3,
    "churn counts every commit that touched it, fixing or not",
  );
});

test("a rule whose files were fixed more often reports a positive lift, and the other direction reports a negative one", () => {
  const dirty = files("dirty", 10);
  const clean = files("clean", 10);
  const all = [...dirty, ...clean];
  const probe = { metric: "x.y", findings: dirty.map((path) => ({ path })), scanned: all };

  // every dirty file was fixed, no clean one was
  const good = probeAgainstHistory(probe, history(all, dirty));
  assert.equal(good.violating.rate, 100);
  assert.equal(good.clean.rate, 0);
  assert.equal(good.lift, 100);
  assert.match(good.verdict, /fixed more often here/);

  // and the rule that points the wrong way says so rather than being rounded to nothing
  const bad = probeAgainstHistory(probe, history(all, clean));
  assert.equal(bad.lift, -100);
  assert.match(bad.verdict, /LESS often here, which is evidence against it/);

  const flat = probeAgainstHistory(
    probe,
    history(all, [...dirty.slice(0, 5), ...clean.slice(0, 5)]),
  );
  assert.equal(flat.lift, 0);
  assert.match(flat.verdict, /no difference here/);
});

test("below the sample floor the answer is 'no idea', not a lift of zero", () => {
  const dirty = files("dirty", SAMPLE_FLOOR - 1);
  const clean = files("clean", 40);
  const all = [...dirty, ...clean];
  const r = probeAgainstHistory(
    { metric: "x.y", findings: dirty.map((path) => ({ path })), scanned: all },
    history(all, dirty),
  );
  assert.equal(r.lift, null, "zero would read as 'no effect'; this is 'no idea'");
  assert.match(r.verdict, /too few files to say/);
  // the counts are still there, so a reader can see how far off the floor it is
  assert.equal(r.violating.files, SAMPLE_FLOOR - 1);
  assert.equal(r.violating.rate, 100);
});

test("churn is reported beside every rate rather than removed, because it is the confounder", () => {
  const dirty = files("dirty", 10);
  const clean = files("clean", 10);
  const all = [...dirty, ...clean];
  const h = history(all, dirty);
  for (const f of dirty) h.churn.set(f, 20);
  const r = probeAgainstHistory(
    { metric: "x.y", findings: dirty.map((path) => ({ path })), scanned: all },
    h,
  );
  assert.equal(r.violating.churn, 20);
  assert.equal(r.clean.churn, 3);
  // a reader can see that the "good" rule may be measuring churn, which is the whole point
  assert.equal(r.lift, 100);
  assert.ok(CAVEATS.some((c) => /Churn is reported beside every rate/.test(c)));
  assert.ok(CAVEATS.some((c) => /correlation, not a cause/i.test(c)));
});

test("a file with no history at all is in neither population", () => {
  const all = files("f", 20);
  const r = probeAgainstHistory(
    { metric: "x.y", findings: [{ path: "src/never-committed.ts" }], scanned: all },
    history(all, all.slice(0, 5)),
  );
  assert.equal(r.violating.files, 0, "a file git has never seen cannot have been fixed");
});

test("the command reads this repository and prints the caveats with the numbers", () => {
  const r = cli(["validate"], process.cwd());
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /commit\(s\), \d+ of them fixing something/);
  assert.match(r.out, /What this is not/);
  for (const c of CAVEATS) assert.ok(r.out.includes(c.slice(0, 40)), c.slice(0, 40));
});
