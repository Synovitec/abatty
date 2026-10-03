import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";

// doctor read red on a fresh install of the docs and astro presets: the harness self-test
// expected migrations/ to be protected, and those presets protect none.

test("doctor is green on a fresh install of a preset that protects no migrations", () => {
  const dir = tempRepo("doctor-docs", {
    "README.md": "# Docs\n",
    "docs/a.md":
      '---\ntitle: "A"\ndescription: "D"\ncategory: reference\nstatus: living\n---\n# A\n',
  });
  cli(["init", dir, "--stack", "docs"], dir);
  const r = cli(["doctor", dir], dir);
  assert.match(r.out, /harness ok/, r.out);
  assert.doesNotMatch(r.out, /migration[^\n]*expected deny/);
});
