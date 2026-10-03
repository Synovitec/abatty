import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { probationReadings } from "../src/core/probation.mjs";

// A check leaves probation once named repositories have run it clean; the report now carries the
// evidence, per check: whether it runs here, what it reads, and how often it was disputed here.
// Every probe still on probation is opt-in since the 1.0 scope (decision 0002), so the example
// is one, enabled in the repository's config.

const FM = (/** @type {string} */ extra = "") =>
  `---\ntitle: T\ndescription: D\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;
const PROBE = "docs.supersededChain";
const CONFIG = JSON.stringify({ ratchet: { enable: [PROBE] } });
/** A repository with the probe enabled. @param {string} name @param {Record<string, string>} files */
const repo = (name, files) =>
  tempRepo(name, {
    "package.json": JSON.stringify({ name: "p" }),
    "abatty.config.json": CONFIG,
    ...files,
  });

test("a check that runs, reads 0 and was never disputed is clean here; a dispute or a finding is not", () => {
  const dir = repo("probation", { "docs/a.md": FM() });
  const readings = probationReadings(dir, {});
  const chain = readings.find((p) => p.metric === PROBE);
  assert.deepEqual(chain, {
    metric: PROBE,
    runs: true,
    reads: 0,
    scanned: 1,
    why: "clean over 1 scanned here: one repository's vote for promotion",
    disputes: 0,
    clean: true,
  });
  const disputed = probationReadings(dir, { [PROBE]: 1 });
  const d = disputed.find((p) => p.metric === PROBE);
  assert.equal(d?.clean, false);
  assert.match(String(d?.why), /^disputed 1 time\(s\) here/);
  const optIn = readings.find((p) => p.metric === "sec.weakRandom");
  assert.equal(optIn?.runs, false, "an opt-in check left off does not run here");
  assert.equal(optIn?.clean, false, "and casts no vote");
  assert.match(String(optIn?.why), /opt-in and not enabled here/);
});

test("a finding keeps a check from reading clean", () => {
  const dir = repo("probation-reads", { "docs/moved.md": FM('superseded_by: "./gone.md"\n') });
  const chain = probationReadings(dir, {}).find((p) => p.metric === PROBE);
  assert.ok((chain?.reads || 0) > 0, JSON.stringify(chain));
  assert.equal(chain?.clean, false);
  assert.match(String(chain?.why), /^reads \d+ here: real debt or a false positive/);
});

test("a check with nothing of its kind to read casts no vote", () => {
  const dir = repo("probation-empty", {});
  const chain = probationReadings(dir, {}).find((p) => p.metric === PROBE);
  assert.equal(chain?.reads, 0);
  assert.equal(chain?.scanned, 0);
  assert.equal(chain?.clean, false, "reading 0 over nothing is not a clean run");
  assert.equal(chain?.why, "nothing of its kind to read here: no vote");
});

test("a green ratchet names the probe on probation that would have failed it", () => {
  const dir = repo("probation-headline", { "docs/a.md": FM() });
  assert.equal(cli(["baseline", dir], dir).code, 0);
  writeFileSync(join(dir, "docs/moved.md"), FM('superseded_by: "./gone.md"\n'));
  git(dir, "add", "-A");
  const r = cli(["ratchet", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(
    r.out,
    /ratchet green .*on probation would fail, not failing: .*docs\.supersededChain/,
  );
});
