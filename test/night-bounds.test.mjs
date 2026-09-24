import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { night, nightRepo } from "./night-helpers.mjs";
import { changedLineCount, openNightWork } from "../src/night/bounds.mjs";

// Two bounds a runner that works unattended needs: it does not start work already open on
// another night branch, and it does not push more change than one review reads.

/** An earlier night branch that worked phase 11 and that main has not taken. @param {string} dir */
function earlierNight(dir) {
  git(dir, "checkout", "-q", "-b", "adopt/standards-2026-01-01");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(
    join(dir, "docs/ADOPTION_STATE.json"),
    JSON.stringify({ phases: [{ id: 11, status: "done" }] }) + "\n",
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: phase 11");
  git(dir, "checkout", "-q", "main");
}

test("a night is refused while an earlier night branch that worked the same phase is open", () => {
  const dir = nightRepo("night-open-work");
  earlierNight(dir);
  const r = night(dir);
  assert.equal(r.ok, false, r.out);
  assert.match(
    r.out,
    /adopt\/standards-2026-01-01 already worked phase\(s\) 11, and main has not taken it/,
  );
});

test("merged, another phase, or tonight's own branch: no open work", () => {
  const dir = tempRepo("bounds-open", { "a.txt": "a\n" });
  git(dir, "branch", "-M", "main");
  earlierNight(dir);
  const o = {
    repoDir: dir,
    prefix: "adopt/standards",
    base: "main",
    stateFile: "docs/ADOPTION_STATE.json",
  };
  assert.deepEqual(openNightWork({ ...o, branch: "adopt/standards-2026-01-02", phases: ["11"] }), [
    { ref: "adopt/standards-2026-01-01", phases: ["11"] },
  ]);
  assert.deepEqual(
    openNightWork({ ...o, branch: "adopt/standards-2026-01-02", phases: ["12"] }),
    [],
  );
  assert.deepEqual(
    openNightWork({ ...o, branch: "adopt/standards-2026-01-01", phases: ["11"] }),
    [],
  );
  git(dir, "merge", "-q", "--ff-only", "adopt/standards-2026-01-01");
  assert.deepEqual(
    openNightWork({ ...o, branch: "adopt/standards-2026-01-02", phases: ["11"] }),
    [],
  );
});

test("a night branch over the diff cap stays local, said", () => {
  const dir = nightRepo("night-diff-cap");
  const origin = tempRepo("night-diff-cap-origin", {});
  git(origin, "config", "receive.denyCurrentBranch", "ignore");
  git(dir, "remote", "add", "origin", origin);
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.maxDiffLines = 1;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "commit", "-qam", "chore: a one-line cap");
  git(dir, "push", "-q", "origin", "main");
  const r = night(dir, { noPush: false });
  assert.match(
    r.out,
    /branch kept local: \d+ changed line\(s\) against main, over the 1 one review reads/,
    r.out,
  );
  assert.equal(r.pushed, false);
  assert.ok(changedLineCount(dir, "main", r.branch) > 1);
});

test("a squash-merged night is taken; a branch only on origin is still open work", () => {
  const dir = tempRepo("bounds-squash", { "a.txt": "a\n" });
  git(dir, "branch", "-M", "main");
  earlierNight(dir);
  const o = {
    repoDir: dir,
    prefix: "adopt/standards",
    base: "main",
    branch: "adopt/standards-2026-01-02",
    stateFile: "docs/ADOPTION_STATE.json",
    phases: ["11"],
  };
  // The branch now lives only as a remote-tracking ref: still open, still refused.
  git(
    dir,
    "update-ref",
    "refs/remotes/origin/adopt/standards-2026-01-01",
    "adopt/standards-2026-01-01",
  );
  git(dir, "branch", "-q", "-D", "adopt/standards-2026-01-01");
  assert.deepEqual(openNightWork(o), [{ ref: "adopt/standards-2026-01-01", phases: ["11"] }]);
  // Squash-merged: main's own state file says phase 11 was worked, though the branch is no ancestor.
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(
    join(dir, "docs/ADOPTION_STATE.json"),
    JSON.stringify({ phases: [{ id: 11, status: "done" }] }) + "\n",
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: squash of phase 11");
  assert.deepEqual(openNightWork(o), []);
  assert.deepEqual(
    openNightWork({ ...o, base: "nowhere" }),
    [],
    "no base: the checkout step refuses, not this one",
  );
});

test("the diff is measured against the base on origin when there is no local one, and not at all without one", () => {
  const dir = tempRepo("bounds-count", { "a.txt": "a\n" });
  git(dir, "branch", "-M", "main");
  git(dir, "checkout", "-q", "-b", "adopt/standards-2026-01-03");
  writeFileSync(join(dir, "a.txt"), "a\nb\nc\n");
  git(dir, "commit", "-qam", "feat: two lines");
  assert.equal(changedLineCount(dir, "main", "adopt/standards-2026-01-03"), 2);
  git(dir, "update-ref", "refs/remotes/origin/develop", "main");
  assert.equal(changedLineCount(dir, "develop", "adopt/standards-2026-01-03"), 2);
  assert.equal(changedLineCount(dir, "nowhere", "adopt/standards-2026-01-03"), -1);
  assert.equal(changedLineCount(dir, "main", "no-such-branch"), -1, "a diff git refuses is not an empty one");
});
