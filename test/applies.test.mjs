import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

/** @param {string} dir */
const findings = (dir) => runCatalog(buildContext(dir), RULES);
/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);

test("every rule that says where it applies says it in a sentence; the catalog and the JSON carry it", () => {
  for (const r of RULES) {
    if (r.applies) assert.ok(r.when, `${r.id}: a rule with applies has when`);
    if (r.when) assert.ok(r.applies, `${r.id}: a rule with when has applies`);
  }
  const withApplies = RULES.filter((r) => r.applies).length;
  assert.ok(withApplies >= 30, `${withApplies} rules say where they apply`);
  const dir = tempRepo("applies-json", { "package.json": NEXT_PKG });
  const json = JSON.parse(cli(["rules", dir, "--json"], dir).out);
  assert.equal(
    json.find((/** @type {{ id: string }} */ r) => r.id === "TEST-INTEGRATION").when,
    "a repository with a database",
  );
  const ex = cli(["explain", "data-migrations", dir], dir);
  assert.match(ex.out, /applies\s+a repository with a database/);
  assert.match(ex.out, /status\s+n\/a/);
  assert.match(ex.out, /does not apply: no database dependency/);
});

test("a documents-only repository is read for what it is: the documents, the instrument, the harness and delivery apply; code, types, tests and data do not", () => {
  const dir = tempRepo("applies-docs", {
    "README.md": "# A product under design\n",
    "docs/ADR-001-shape.md": "# The shape\n",
    "docs/decisions.md": "# Decisions\n",
  });
  const f = findings(dir);
  const na = f.filter((x) => x.status === "n/a");
  const applicable = f.filter((x) => x.status !== "n/a");
  assert.ok(na.length >= 35, `${na.length} n/a`);
  assert.ok(applicable.length >= 20 && applicable.length <= 30, `${applicable.length} applicable`);
  for (const id of [
    "CODE-ESLINT",
    "TYPES-STRICT",
    "TEST-UNIT",
    "DATA-MIGRATIONS",
    "SEC-AUDIT",
    "VALID-ZOD",
    "A11Y-LINT",
  ]) {
    const x = of(f, id);
    assert.equal(x.status, "n/a", `${id} on a documents-only repository`);
    assert.match(x.evidence, /^does not apply: /, id);
  }
  for (const id of [
    "DOC-CHANGELOG",
    "DOC-ADR",
    "INST-CI",
    "INST-GATE",
    "FLOW-CHANGELOG-GATE",
    "SEC-SECRETS",
  ])
    assert.notEqual(of(f, id).status, "n/a", `${id} applies to a documents-only repository`);
  assert.equal(
    of(f, "CODE-ESLINT").evidence,
    "does not apply: no JavaScript or TypeScript sources",
  );
});

test("the facts decide: a database dependency makes the data rules apply, a browser framework the browser rules, sources the code rules", () => {
  const plain = tempRepo("applies-node", {
    "package.json":
      JSON.stringify({ name: "svc", private: true, dependencies: { express: "4.0.0" } }) + "\n",
    "src/server.js": "module.exports = 1;\n",
  });
  const p = findings(plain);
  assert.equal(of(p, "DATA-MIGRATIONS").status, "n/a");
  assert.equal(of(p, "TEST-E2E").status, "n/a");
  assert.equal(of(p, "TEST-E2E").evidence, "does not apply: no browser application");
  assert.equal(of(p, "VALID-ZOD").status, "missing", "a server is a boundary");
  assert.equal(of(p, "CODE-ESLINT").status, "missing");

  const db = tempRepo("applies-db", {
    "package.json":
      JSON.stringify({
        name: "svc",
        private: true,
        dependencies: { express: "4.0.0", pg: "8.0.0" },
      }) + "\n",
    "src/server.js": "module.exports = 1;\n",
  });
  const d = findings(db);
  assert.equal(of(d, "DATA-MIGRATIONS").status, "missing", "a driver is a database");
  assert.equal(of(d, "TEST-INTEGRATION").status, "missing");
  assert.equal(of(d, "DATA-BACKUP").status, "missing");

  const ui = tempRepo("applies-ui", {
    "package.json": NEXT_PKG,
    "src/app/page.tsx": "export default function Page() { return null; }\n",
  });
  const u = findings(ui);
  assert.equal(of(u, "TEST-E2E").status, "missing", "a browser application without a suite");
  assert.equal(of(u, "A11Y-LINT").status, "missing");
  assert.equal(of(u, "I18N-LINT").status, "missing", "a browser application has user-facing text");
  assert.equal(of(u, "PWA-CONTRACT").status, "n/a");
  assert.equal(of(u, "DATA-MIGRATIONS").status, "n/a");
});
