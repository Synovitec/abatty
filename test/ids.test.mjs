import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { RULES } from "../src/rules/index.mjs";
import { stdIds } from "../src/core/gap-analysis.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const HYPHEN =
  /\b(P|AIR|CODE|VALID|DATA|SEC|FLOW|DOC|CHANGE|TEST|API|I18N|CACHE|UI|PWA|OBS|FLAG|CONFIG|AUTH|A11Y)-\d{1,2}\b/;

/** @param {string} dir @param {string[]} [acc] */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(md|mjs|json|template)$/.test(name)) acc.push(p);
  }
  return acc;
}

test("the standard's rule IDs are namespaced (FAMILY.N): the hyphen form is gone from the standard, the templates, the sources and the README", () => {
  const living = [
    ...walk(join(ROOT, "docs/standard")),
    ...walk(join(ROOT, "templates")),
    ...walk(join(ROOT, "src")),
    join(ROOT, "README.md"),
    join(ROOT, "bin/abatty.mjs"),
  ];
  const offenders = living
    .filter((f) => HYPHEN.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(offenders, []);
  assert.equal(
    stdIds("CODE-6 and DOC-2, but SHA-256 and CODE-DEADCODE stay"),
    "CODE.6 and DOC.2, but SHA-256 and CODE-DEADCODE stay",
  );
});

test("every standard ID a rule cites exists in the standard's document, in the namespaced form", () => {
  const standard = readFileSync(join(ROOT, "docs/standard/ENGINEERING_STANDARD.md"), "utf8");
  /** @type {string[]} */
  const missing = [];
  for (const r of RULES)
    for (const id of r.standard || []) {
      assert.match(id, /^[A-Z0-9]+\.\d{1,2}$/, `${r.id} cites ${id}`);
      if (!standard.includes(id)) missing.push(`${r.id} → ${id}`);
    }
  assert.deepEqual(missing, []);
});
