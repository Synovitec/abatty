import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepStale } from "../src/core/prove-sweep.mjs";

// prove runs stopped before their cleanup left 49 MB copies in an adopter's temp folder, the links
// to the repository's node_modules still in them. The next run sweeps them, links first.

test("a stale copy is unlinked then removed, never reaching what its links point at; a fresh one stays", () => {
  const root = mkdtempSync(join(tmpdir(), "abatty-sweep-root-"));
  const repo = join(root, "repo");
  mkdirSync(join(repo, "node_modules/kept"), { recursive: true });
  writeFileSync(join(repo, "node_modules/kept/index.js"), "module.exports = 1;\n");

  /** A copy as prove makes one, with its dependency link. @param {number} ageMs */
  const copy = (ageMs) => {
    const at = mkdtempSync(join(root, "abatty-prove-"));
    writeFileSync(join(at, "package.json"), "{}\n");
    symlinkSync(join(repo, "node_modules"), join(at, "node_modules"), "junction");
    const when = new Date(Date.now() - ageMs);
    utimesSync(at, when, when);
    return at;
  };
  const stale = copy(3 * 60 * 60 * 1000);
  const fresh = copy(60 * 1000);
  const logs = mkdtempSync(join(root, "abatty-prove-logs-"));
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  utimesSync(logs, old, old);

  assert.deepEqual(sweepStale({ dir: root }), { copies: 1, logs: 1 });
  assert.equal(existsSync(stale), false, "the stale copy is gone");
  assert.equal(existsSync(logs), false, "a week-old log folder is gone");
  assert.ok(existsSync(join(fresh, "package.json")), "a run still using its copy keeps it");
  assert.ok(
    existsSync(join(repo, "node_modules/kept/index.js")),
    "the repository's dependencies are untouched",
  );
  rmSync(root, { recursive: true, force: true });
});
