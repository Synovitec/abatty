import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import {
  REGULATION,
  REQUIREMENTS,
  mapRequirements,
  mappingShape,
} from "../src/profiles/cra-requirements.mjs";
import { cra } from "../src/profiles/cra.mjs";
import { PROFILES, validateProfile } from "../src/profiles/index.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { renderEvidence } from "../src/ui/evidence.mjs";

test("the mapping is a lens and not a standard: it adds no rules, and every rule it names exists", () => {
  assert.deepEqual(cra.rules, [], "a profile that invented CRA rules would be selling a lie");
  assert.deepEqual(validateProfile(cra), []);
  assert.ok(PROFILES.some((p) => p.id === "cra"));

  const known = new Set(RULES.map((r) => r.id));
  for (const r of REQUIREMENTS)
    for (const id of r.rules)
      assert.ok(known.has(id), `${r.id} names ${id}, which is not a rule in the catalog`);
});

test("every requirement says what it does not cover, and the empty ones are not quietly dropped", () => {
  for (const r of REQUIREMENTS) {
    assert.ok(r.gap.length > 40, `${r.id}: the gap is the most important column and must be words`);
    assert.ok(r.title.length > 10, `${r.id}: no title`);
    assert.ok(["I", "II"].includes(r.part));
    if (!r.rules.length)
      assert.equal(r.covers, "nothing", `${r.id}: no rules, so it covers nothing, and says so`);
  }
  const shape = mappingShape();
  assert.equal(shape.total, REQUIREMENTS.length);
  assert.ok(shape.withoutRules >= 5, "a mapping where everything is covered is a mapping lying");
  assert.equal(shape.withRules + shape.withoutRules, shape.total);
  assert.match(REGULATION.warning, /not a conformity assessment/);
  assert.match(REGULATION.warning, /not legal advice/);
});

test("a rule that does not apply to a repository is neither held nor broken", () => {
  // A library with no service: the observability rules are n/a, and the requirements that name
  // only those must not read as failures.
  const dir = tempRepo("cra-lib", {
    "package.json": JSON.stringify({ name: "lib", version: "0.1.0", private: true }) + "\n",
    "src/index.ts": "export const x = 1;\n",
  });
  const rows = mapRequirements(runCatalog(buildContext(dir), RULES));
  const dataMin = rows.find((r) => r.id === "I.3.e");
  assert.equal(dataMin?.evidence[0]?.status, "n/a");
  assert.equal(dataMin?.standing, "no named rule applies to this repository");
  assert.equal(rows.find((r) => r.id === "I.3.a")?.standing, "nothing claimed");

  // and none of the words the mapping can say is "met"
  for (const r of rows) assert.equal(/\bmet\b|conform/i.test(r.standing), false, r.standing);
});

test("a rule the catalog does not carry is reported absent, never skipped into a better figure", () => {
  const rows = mapRequirements([]);
  const first = rows.find((r) => r.rules.length);
  assert.equal(first?.evidence[0]?.status, "not in this catalog");
  assert.equal(
    first?.standing,
    "no applicable rule holds",
    "a rule the catalog does not carry cannot count as held",
  );
});

test("the evidence export leads with what nothing bears on, and never calls itself a conformity assessment", () => {
  const dir = tempRepo("cra-doc", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const md = renderEvidence({
    findings: runCatalog(buildContext(dir), RULES),
    name: "fixture",
    date: "2026-09-19",
    commit: "0123456789abcdef0123456789abcdef01234567",
    version: "9.9.9",
    score: 61,
  });
  const empty = md.indexOf("## The requirements nothing here bears on");
  const covered = md.indexOf("## The requirements some rule bears on");
  assert.ok(empty > 0 && covered > empty, "the empty requirements come first, on purpose");
  // and they are actually listed, with their reason: a section heading over nothing is worse
  // than no section, because it reads as "none" when the answer is seven.
  const section = md.slice(empty, covered);
  for (const r of REQUIREMENTS.filter((x) => !x.rules.length)) {
    assert.ok(section.includes(`| ${r.id} |`), `${r.id} is missing from the empty table`);
    assert.ok(section.includes(r.gap), `${r.id} is listed without the reason nothing bears on it`);
  }
  assert.match(md, /not a conformity assessment/);
  assert.match(md, /not legal advice/);
  assert.match(md, /is not a grade, not a percentage of conformity/);
  assert.match(md, /paraphrase/);
  // it is a document, with front matter, that the docs probes can read
  assert.match(md, /^---\ntitle: "Evidence against the essential requirements/);

  const r = cli(["evidence", dir, "--out", "docs/EVIDENCE.md"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /a mapping, never a conformity assessment/);
});
