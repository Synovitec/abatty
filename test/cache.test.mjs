/**
 * The cache exists so the second reading of an unchanged tree is nearly free. One property
 * governs it and every case here is about that property: a cache must never be able to turn a
 * finding into a pass. Speed that costs correctness is not speed, it is a silent pass with a
 * stopwatch.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { cacheKey, readCache, writeCache } from "../src/core/cache.mjs";
import { buildReport } from "../src/core/report.mjs";

/** @param {string} name */
function committed(name) {
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "src/a.mjs": "export const a = 1;\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  return dir;
}

test("the key follows the content, not the clock", () => {
  const dir = committed("cache-key");
  const first = cacheKey(dir, { version: "1.0.0" });
  assert.ok(first, "a git repository has a key");
  assert.equal(cacheKey(dir, { version: "1.0.0" }), first, "nothing changed, nothing moved");

  // A different version of the package is a different reading.
  assert.notEqual(cacheKey(dir, { version: "1.0.1" }), first);

  // An edit moves the key even when the size is identical and the second is the same: mtime
  // cannot tell those apart and the one it misses is the one that would have been a finding.
  writeFileSync(join(dir, "src/a.mjs"), "export const a = 2;\n");
  const edited = cacheKey(dir, { version: "1.0.0" });
  assert.notEqual(edited, first);

  // Restored, the key comes back: a file touched and put back is not a change.
  writeFileSync(join(dir, "src/a.mjs"), "export const a = 1;\n");
  assert.equal(cacheKey(dir, { version: "1.0.0" }), first);

  // An untracked file counts, because a rule can read it.
  writeFileSync(join(dir, "NEW.md"), "# new\n");
  assert.notEqual(cacheKey(dir, { version: "1.0.0" }), first);
  rmSync(join(dir, "NEW.md"));
  assert.equal(cacheKey(dir, { version: "1.0.0" }), first);
});

test("a repository without git has no key, so it is measured every time", () => {
  const dir = tempRepo("cache-nogit", { "README.md": "# x\n" });
  rmSync(join(dir, ".git"), { recursive: true, force: true });
  assert.equal(cacheKey(dir, { version: "1.0.0" }), null);
  assert.equal(readCache(dir, null), null);
  writeCache(dir, null, { anything: true });
});

test("a change that creates a finding is never served from the cache", async () => {
  const dir = committed("cache-safety");
  const first = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  const before = first.findings.find((f) => f.id === "DOC-CHANGELOG");
  assert.ok(before);
  assert.equal(before.status, "missing", "no changelog yet");

  // The same tree again: the reading is the cached one, and it is the same reading.
  const again = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  assert.equal(again.score, first.score);

  // Now the repository earns the rule. A cache that answered from the old key here would be
  // reporting a finding that no longer exists; the failure in the other direction - a pass where
  // there is now a finding - is the one that ends a gate's credibility.
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# Changelog\n\nKeep a Changelog, SemVer.\n\n## [Unreleased]\n\n### Added\n\n- a line\n",
  );
  const after = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  const now = after.findings.find((f) => f.id === "DOC-CHANGELOG");
  assert.ok(now);
  assert.equal(now.status, "present", "the edit is seen, not served from the cache");

  // And in the other direction: taking it away brings the finding back, in the same session.
  rmSync(join(dir, "CHANGELOG.md"));
  const removed = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  assert.equal(removed.findings.find((f) => f.id === "DOC-CHANGELOG")?.status, "missing");
});

test("cache: false measures, whatever is on disk", async () => {
  const dir = committed("cache-off");
  const a = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  writeCache(dir, cacheKey(dir, { version: "9.9.9" }), { ...a, score: 999 });
  const served = await buildReport(dir, { abattyVersion: "9.9.9", write: false });
  assert.equal(served.score, 999, "the cache is read when it is allowed to be");
  const fresh = await buildReport(dir, { abattyVersion: "9.9.9", write: false, cache: false });
  assert.equal(fresh.score, a.score, "and skipped when it is not");
});
