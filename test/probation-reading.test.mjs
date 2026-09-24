import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { probationReadings } from "../src/core/probation.mjs";

// A check leaves probation once named repositories have run it clean; the report now carries the
// evidence, per check: whether it runs here, what it reads, and how often it was disputed here.

const FM = "---\ntitle: T\ndescription: D\ncategory: reference\nstatus: living\n---\n\n# T\n";

test("a check that runs, reads 0 and was never disputed is clean here; a dispute or a finding is not", () => {
  const dir = tempRepo("probation", {
    "package.json": JSON.stringify({ name: "p" }),
    "docs/a.md": FM,
  });
  const readings = probationReadings(dir, {});
  const syntax = readings.find((p) => p.metric === "docs.frontMatterSyntax");
  assert.deepEqual(syntax, {
    metric: "docs.frontMatterSyntax",
    runs: true,
    reads: 0,
    disputes: 0,
    clean: true,
  });
  const disputed = probationReadings(dir, { "docs.frontMatterSyntax": 1 });
  assert.equal(disputed.find((p) => p.metric === "docs.frontMatterSyntax")?.clean, false);
  const optIn = readings.find((p) => p.metric === "sec.weakRandom");
  assert.equal(optIn?.runs, false, "an opt-in check left off does not run here");
  assert.equal(optIn?.clean, false, "and casts no vote");
});

test("a finding keeps a check from reading clean", () => {
  const dir = tempRepo("probation-reads", {
    "package.json": JSON.stringify({ name: "p" }),
    "docs/a.md": "---\ntitle: T\ndescription: D: with a colon\ncategory: reference\n---\n\n# T\n",
  });
  const syntax = probationReadings(dir, {}).find((p) => p.metric === "docs.frontMatterSyntax");
  assert.ok((syntax?.reads || 0) > 0, JSON.stringify(syntax));
  assert.equal(syntax?.clean, false);
});
