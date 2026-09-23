import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import prettier from "prettier";
import { formatJson } from "../src/core/repo.mjs";

// The files this package writes into a repository must survive that repository's format check
// unchanged, or the next `baseline` or `update` turns its gate red: an adopter had to put the
// baseline in .prettierignore. The judge is the formatter itself, a development dependency here.

/** The formatter's own rendering of a value written the way JSON.stringify writes it. @param {unknown} v @param {number} width */
const formatted = (v, width) =>
  prettier.format(JSON.stringify(v, null, 2) + "\n", { parser: "json", printWidth: width });

const CASES = {
  "short arrays inline, long ones one per line, empty ones kept": {
    enable: ["valid.wholeEnv", "fn.shapeExemptions", "change.refactorTests", "code.clones"],
    exempt: [
      "(^|/)(generated|__generated__|vendor|vendored)/",
      "(^|/)(migrations|seeders|seeds)/",
      "(^|/)(i18n|locales|messages|dictionaries)/",
    ],
    none: [],
    empty: {},
    nested: { list: [1, 2, 3], flag: true, nothing: null },
  },
  "an array of objects stays expanded": { coupled: [{ when: "a/", then: "b/", why: "because" }] },
  "an array right at the width": {
    key: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
  },
};

test("what the package writes is what the formatter would write, at its default width and at 100", async () => {
  for (const [name, v] of Object.entries(CASES))
    for (const width of [80, 100])
      assert.equal(formatJson(v, width), await formatted(v, width), `${name} @ ${width}`);
});

test("this repository's own baseline and config come out exactly as the formatter leaves them", async () => {
  for (const f of [
    "scripts/ci/standards-baseline.json",
    "abatty.config.json",
    ".claude/harness.lock.json",
  ]) {
    const v = JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
    assert.equal(formatJson(v, 100), await formatted(v, 100), f);
  }
});
