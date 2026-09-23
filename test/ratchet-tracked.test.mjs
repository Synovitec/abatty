import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import { BUILTIN_PROBES, DEFAULT_CONFIG, measureAll } from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// An adopter's docs tooling wrote a dated report under docs/ on every run, never committed and
// never ignored. The ratchet read it as a document without front matter, so every push regressed
// the floor with no human change until somebody ignored the folder. The ratchet reads what git
// tracks; the rules and the measurement still read the working tree.

const FM = '---\ntitle: "A"\ndescription: "a"\nstatus: living\n---\n\n# A\n';
const probe = BUILTIN_PROBES.filter((p) => p.metric === "docs.frontMatter");

/** @param {string} dir @param {boolean} tracked */
const frontMatterDebt = (dir, tracked) =>
  measureAll(probe, buildContext(dir, { tracked }), { config: DEFAULT_CONFIG, range: "" }, null)[0]
    ?.value;

test("a generated doc nobody committed moves no ratchet number; the same doc staged does", () => {
  const dir = tempRepo("tracked-docs", { "docs/README.md": FM });
  mkdirSync(join(dir, "docs/audits"), { recursive: true });
  writeFileSync(join(dir, "docs/audits/2026-09-23-docs-staleness.md"), "# Staleness\n");
  assert.equal(frontMatterDebt(dir, true), 0, "untracked: not the repository");
  assert.equal(frontMatterDebt(dir, false), 1, "the working-tree reading still sees it");
  git(dir, "add", "docs/audits");
  assert.equal(frontMatterDebt(dir, true), 1, "staged: about to be committed, so counted");
});

test("abatty ratchet reads the tracked tree: an untracked generated doc leaves it green", () => {
  const dir = tempRepo("tracked-cli", {
    "package.json": JSON.stringify({ name: "t", version: "0.1.0" }),
    "docs/README.md": FM,
  });
  const baseline = cli(["baseline", dir], dir);
  assert.equal(baseline.code, 0, baseline.out);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "baseline");
  writeFileSync(join(dir, "docs/2026-09-23-report.md"), "# Report\n");
  const r = cli(["ratchet", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /docs\.frontMatter\s+1/);
});
