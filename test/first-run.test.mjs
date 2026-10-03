/**
 * The first run, in a repository that has nothing. Every tool that became ordinary produced
 * something useful before it was configured: a reading that needs a `--stack` and a config file
 * to say anything is a tool a stranger closes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";

test("a repository with nothing gets a reading, a stage and a next step, with no configuration", () => {
  // No package.json, no config, no --stack, no profile: one file and a git repository.
  const dir = tempRepo("first-run", { "README.md": "# a repository\n" });
  const r = cli([dir], dir);
  assert.equal(r.code, 0, r.out);
  // The phase it is on, which is the number a reader can act on this week, of the profile init
  // would set up: with no config the reading is minimal's, not the whole standard's.
  assert.match(r.out, /phase 1 /);
  assert.match(r.out, /of \d+ held/);
  // The stage read off the tree rather than demanded from a config.
  assert.match(r.out, /stage\s+design/);
  // A preset detected without being named: documents alone is a stack.
  assert.match(r.out, /stack\s+Documents/);
  // And at least one next step, named as a rule a reader can ask about.
  assert.match(r.out, /Next/);
  assert.match(r.out, /INST-CI/);
  assert.doesNotMatch(r.out, /DOC-CONTEXT/, "no rule of the full standard nobody chose");
  assert.match(r.out, /abatty explain <ID>/);
  // And the command a stranger runs first, named on the first screen.
  assert.match(r.out, /abatty prove · measure/);
});

test("measure needs no configuration either, and says what it would do next", () => {
  const dir = tempRepo("first-measure", { "README.md": "# a repository\n" });
  const r = cli(["measure", dir, "--quiet"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Phase 1: \d+ of \d+ held/);
  assert.match(r.out, /Score \d+\/100 over \d+ applicable checks/);
});
