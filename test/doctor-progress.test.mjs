import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { doctor } from "../src/core/doctor.mjs";

// doctor printed its banner only once every check had returned, so an adopter whose doctor sat
// in one check for minutes saw nothing at all and could not say where it was.

test("doctor names each check before it starts, in the order it runs them", () => {
  const dir = tempRepo("doctor-steps", { "package.json": NEXT_PKG });
  /** @type {string[]} */
  const seen = [];
  doctor({ repoDir: dir, preset: null, skipSelfTest: true, step: (s) => seen.push(s) });
  assert.deepEqual(seen, [
    "drift against the templates",
    "permissions",
    "opt-in probes",
    "config",
    "hook modes",
    "hook file modes",
  ]);
});

test("the banner comes before the work, and --verbose prints each check as it starts", () => {
  const dir = tempRepo("doctor-verbose", { "package.json": NEXT_PKG });
  const quiet = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.doesNotMatch(quiet.out, /· opt-in probes/, "quiet by default");
  const r = cli(["doctor", dir, "--skip-self-test", "--verbose"], dir);
  const banner = r.out.indexOf("doctor ·");
  const first = r.out.indexOf("· drift against the templates");
  assert.ok(banner >= 0 && first > banner, r.out);
  assert.ok(r.out.indexOf("· opt-in probes") > first);
});
