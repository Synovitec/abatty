import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";

// measure wrote docs/GAP_ANALYSIS_<date>.md on every run: it piled up, dirtied the tree a night
// refuses, and once committed turned the ratchet red as a document the docs index does not list.

test("measure keeps its report under .abatty, and leaves docs and the tree as they were", () => {
  const dir = tempRepo("measure-quiet", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  const before = readdirSync(join(dir, "docs")).sort();
  const r = cli(["measure", dir, "--quiet"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\.abatty\/reports\/\d{4}-\d{2}-\d{2}\.md/);
  assert.deepEqual(readdirSync(join(dir, "docs")).sort(), before, "nothing new under docs/");
  assert.equal(git(dir, "status", "--porcelain"), "", "the tree is as it was");
});

test("a repository that keeps its readings asks for one in docs, and the series still links", () => {
  const dir = tempRepo("measure-out", { "package.json": NEXT_PKG });
  writeFileSync(
    join(dir, "GAP_ANALYSIS_2000-01-01.md"),
    '---\ntitle: "Gap analysis"\ndescription: "D"\ncategory: reference\nstatus: living\n---\n\n# Old\n',
  );
  const out = "GAP_ANALYSIS_2000-01-02.md";
  const r = cli(["measure", dir, "--out", out], dir);
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(join(dir, out)), r.out);
  assert.match(readFileSync(join(dir, "GAP_ANALYSIS_2000-01-01.md"), "utf8"), /superseded_by/);
});

test("the report names no related path, which one docs check reads from the root and another from the file", () => {
  const dir = tempRepo("measure-related", { "package.json": NEXT_PKG });
  cli(["measure", dir, "--quiet"], dir);
  const file = readdirSync(join(dir, ".abatty/reports")).find((f) => f.endsWith(".md"));
  const text = readFileSync(join(dir, ".abatty/reports", String(file)), "utf8");
  assert.match(text, /^status: stable$/m);
  assert.doesNotMatch(text, /^related:/m);
});
