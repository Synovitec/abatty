import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import {
  FAMILIES,
  RULES,
  controlOf,
  enforcedOf,
  waiverOf,
  loadCatalog,
  ruleById,
  runCatalog,
  scoreOf,
  validate,
} from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { analyze, measure } from "../src/core/gap-analysis.mjs";
import { renderCatalogMarkdown } from "../src/ui/catalog.mjs";

// The checks of the first days, by ID: a rule renamed or dropped by accident would break every
// dated report that cites it. Adding one appends here.
const IDS = [
  "DOC-CONTEXT",
  "DOC-CONTEXT-SECTIONS",
  "DOC-RULES",
  "DOC-CONVENTIONS",
  "DOC-PROGRESS",
  "DOC-CHANGELOG",
  "DOC-INDEX",
  "DOC-ADR",
  "DOC-FRONTMATTER",
  "DOC-FRESHNESS",
  "DOC-AGENTS-MD",
  "INST-RATCHET",
  "INST-DEBT",
  "INST-CONTROLS",
  "INST-GATE",
  "INST-PRECOMMIT",
  "INST-CI",
  "INST-CI-STEPS",
  "INST-DEAD-CI",
  "HARNESS-HOOKS",
  "HARNESS-ADOPTION",
  "HARNESS-SKILL",
  "HARNESS-GITIGNORE",
  "CODE-LINTER",
  "CODE-MAXWARN",
  "CODE-SHAPE",
  "CODE-JSDOC",
  "CODE-ARCH-IMPORTS",
  "CODE-ARCH-GRAPH",
  "CODE-DEADCODE",
  "CODE-DUP",
  "CODE-SIZE-800",
  "CODE-SIZE-300",
  "CODE-BARRELS",
  "CODE-FORMAT",
  "TYPES-CHECKJS",
  "TYPES-STRICT",
  "TYPES-SCRIPT",
  "TYPES-ESCAPES",
  "VALID-ZOD",
  "VALID-ENV",
  "DATA-MIGRATIONS",
  "DATA-TENANT",
  "DATA-BACKUP",
  "TEST-UNIT",
  "TEST-INTEGRATION",
  "TEST-COVERAGE",
  "TEST-E2E",
  "TEST-E2E-CONFIG",
  "TEST-MUTATION",
  "SEC-SECRETS",
  "SEC-AUDIT",
  "SEC-LOCKFILE",
  "SEC-ENVFILES",
  "FLOW-COMMITS",
  "FLOW-TRAILER",
  "FLOW-EMDASH",
  "FLOW-CHANGELOG-GATE",
  "FLOW-VERSION",
  "I18N-CATALOGUE",
  "I18N-LINT",
  "I18N-PARITY",
  "A11Y-LINT",
  "A11Y-CONTRAST",
  "PWA-CONTRACT",
  "OBS-STRUCTURED",
  "OBS-REDACTION",
  "OBS-CONSOLE",
  "OBS-SIGTERM",
  "OBS-HEALTH",
  "OBS-TRACKER",
  "SEC-AGENT-SANDBOX",
  "SEC-AGENT-PERMISSIONS",
  "SEC-AGENT-TRUST",
  "SEC-AGENT-MCP",
  "SEC-AGENT-SHIM",
  "SEC-AGENT-BYPASS",
];

test("the catalog is well-formed: 77 rules, unique IDs, every field, a reason on each", () => {
  assert.deepEqual(validate(RULES), []);
  assert.deepEqual(
    RULES.map((r) => r.id),
    IDS,
  );
  assert.equal(FAMILIES.length, 15);
  for (const r of RULES) {
    assert.ok(r.why.length > 40, `${r.id}: why is too short to be a reason`);
    assert.ok(r.title.length > 10, `${r.id}: title`);
    for (const s of r.standard || [])
      assert.match(s, /^[A-Z0-9]+\.\d{1,2}$/, `${r.id}: standard ${s}`);
  }
  assert.ok(RULES.filter((r) => r.level === "must").length > 40);
  assert.ok(RULES.some((r) => r.enforcement === "ratchet"));
  assert.ok(RULES.some((r) => r.enforcement === "prose"));
});

test("validate names what a malformed rule lacks", () => {
  const problems = validate(
    /** @type {any} */ ([
      {
        id: "bad id",
        family: "X",
        title: "t",
        level: "maybe",
        enforcement: "hope",
        phase: "1",
        why: "w",
        next: "n",
      },
    ]),
  );
  assert.ok(problems.some((p) => /id must be FAMILY-NAME/.test(p)));
  assert.ok(problems.some((p) => /level must be/.test(p)));
  assert.ok(problems.some((p) => /enforcement must be/.test(p)));
  assert.ok(problems.some((p) => /check must be a function/.test(p)));
});

test("a machine ceiling is a claim, so it carries its reason and never sits below where the rule already is", () => {
  const ok = {
    id: "X-Y",
    family: "f",
    title: "t",
    phase: "0",
    why: "w",
    next: "n",
    level: /** @type {const} */ ("must"),
    enforcement: /** @type {const} */ ("review"),
    check: () => ({ status: /** @type {const} */ ("present"), evidence: "e" }),
  };
  assert.deepEqual(
    validate([{ ...ok, ceiling: { at: "review", why: "a drill, not a scan" } }]),
    [],
  );
  assert.deepEqual(validate([ok]), [], "no ceiling is not a problem");
  assert.match(
    validate(/** @type {any} */ ([{ ...ok, ceiling: { at: "review" } }])).join(""),
    /ceiling\.why must say what a machine cannot see/,
  );
  assert.match(
    validate(/** @type {any} */ ([{ ...ok, ceiling: { at: "prose", why: "x" } }])).join(""),
    /ceiling prose is below the enforcement review/,
  );
  // every declared ceiling in the catalog says what a machine cannot see, not that it is hard
  for (const r of RULES.filter((x) => x.ceiling))
    assert.ok(
      String(r.ceiling?.why).length > 60,
      `${r.id}: a ceiling without a reason is an excuse`,
    );
});

test("a check that throws is a finding, never a crash of the measurement", () => {
  const dir = tempRepo("throws", { "package.json": NEXT_PKG });
  const ctx = buildContext(dir);
  const [f] = runCatalog(ctx, [
    {
      .../** @type {import("../src/rules/index.mjs").Rule} */ (RULES[0]),
      id: "X-BOOM",
      check: () => {
        throw new Error("boom");
      },
    },
  ]);
  assert.equal(f?.status, "missing");
  assert.match(f?.evidence || "", /check failed: boom/);
});

test("analyze runs the catalog: one finding per rule, the score over the applicable ones", () => {
  const dir = tempRepo("analyze", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const r = analyze(dir);
  assert.equal(r.findings.length, RULES.length);
  assert.equal(r.findings.filter((f) => f.status === "n/a").length + r.applicable, RULES.length);
  assert.equal(scoreOf(r.findings).score, r.score);
  const f = r.findings.find((x) => x.id === "DOC-CHANGELOG");
  assert.equal(f?.status, "missing");
  assert.equal(f?.level, "must");
  assert.equal(f?.enforcement, "hard");
  assert.deepEqual(f?.standard, ["CHANGE.1"]);
  // A TypeScript repository: the checkJs rule is n/a, the strict one applies.
  assert.equal(r.findings.find((x) => x.id === "TYPES-CHECKJS")?.status, "n/a");
  assert.notEqual(r.findings.find((x) => x.id === "TYPES-STRICT")?.status, "n/a");
});

test("a waiver with a reason lists the rule and takes it out of the score; one past its date does not", async () => {
  const dir = tempRepo("waive", { "package.json": NEXT_PKG, "src/a.ts": "export const a = 1;\n" });
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude", "adoption.json"), JSON.stringify({ rules: { waived: {} } }));
  const plain = await measure(dir);
  writeFileSync(
    join(dir, ".claude", "adoption.json"),
    JSON.stringify({
      rules: {
        waived: {
          "DOC-CHANGELOG": {
            reason: "the changelog lives in the release notes",
            until: "2099-01-01",
          },
          "CODE-DUP": "not measured on a prototype",
          "TEST-MUTATION": { reason: "expired", until: "2000-01-01" },
          "NOPE-X": "not a rule",
        },
      },
    }),
  );
  const r = await measure(dir);
  assert.equal(r.findings.find((f) => f.id === "DOC-CHANGELOG")?.status, "waived");
  assert.match(
    r.findings.find((f) => f.id === "DOC-CHANGELOG")?.evidence || "",
    /release notes.*until 2099/,
  );
  assert.equal(r.findings.find((f) => f.id === "CODE-DUP")?.status, "waived");
  assert.equal(r.findings.find((f) => f.id === "TEST-MUTATION")?.status, "missing");
  assert.equal(r.waived, 2);
  assert.equal(r.applicable, plain.applicable - 2);
  assert.ok(r.score >= plain.score, "two missing rules waived: the score cannot fall");
  assert.ok(r.problems.some((p) => /NOPE-X is not a rule/.test(p)));
  const cli1 = cli(["measure", dir, "--quiet"], dir);
  assert.equal(cli1.code, 0, cli1.out);
  assert.match(cli1.out, /NOPE-X is not a rule/);
});

test("a repository adds its own rules from abatty.rules.mjs; a built-in id is refused", async () => {
  const dir = tempRepo("local", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
    OWNERS: "team\n",
  });
  writeFileSync(
    join(dir, "abatty.rules.mjs"),
    `export const rules = [{
      id: "OWN-OWNERS", family: "Ownership", title: "An OWNERS file names the team", level: "must", enforcement: "prose", phase: "0",
      why: "A repository without an owner is a repository nobody answers for; the file is the name.",
      next: "Add OWNERS at the root",
      check: (c) => ({ status: c.exists("OWNERS") ? "present" : "missing", evidence: c.exists("OWNERS") ? "OWNERS" : "none" }),
    }];\n`,
  );
  const catalog = await loadCatalog(dir);
  assert.deepEqual(catalog.problems, []);
  assert.equal(catalog.localFile, "abatty.rules.mjs");
  assert.equal(catalog.rules.length, RULES.length + 1);
  assert.equal(ruleById("own-owners", catalog.rules)?.source, "abatty.rules.mjs");
  const r = await measure(dir);
  assert.equal(r.findings.find((f) => f.id === "OWN-OWNERS")?.status, "present");
  assert.ok(r.families.includes("Ownership"));
  const ex = cli(["explain", "OWN-OWNERS", dir], dir);
  assert.equal(ex.code, 0, ex.out);
  assert.match(ex.out, /OWN-OWNERS/);
  assert.match(ex.out, /nobody answers for/);
  assert.match(ex.out, /present/);
  // A built-in id redefined: refused with the reason, the file's rules not loaded.
  writeFileSync(
    join(dir, "abatty.rules.mjs"),
    `export const rules = [{ id: "CODE-DUP", family: "Code", title: "mine", level: "must", enforcement: "hard", phase: "1", why: "because I said so, at length", next: "n", check: () => ({ status: "present", evidence: "" }) }];\n`,
  );
  const again = await loadCatalog(dir);
  assert.ok(again.problems.some((p) => /CODE-DUP is a built-in id/.test(p)));
  assert.equal(again.rules.length, RULES.length);
});

test("abatty rules lists the catalog, filters it, and explain refuses an unknown id", () => {
  const dir = tempRepo("rules-cli", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const all = cli(["rules", dir], dir);
  assert.equal(all.code, 0, all.out);
  assert.match(all.out, /77 of 77/);
  assert.match(all.out, /CODE-DEADCODE/);
  assert.match(all.out, /\d+ must · \d+ should · insured by: \d+ hard/);
  const fam = cli(["rules", dir, "--family", "Security", "--level", "must"], dir);
  assert.match(fam.out, /4 of 77/);
  assert.doesNotMatch(fam.out, /CODE-DEADCODE/);
  const ph = cli(["rules", dir, "--phase", "12", "--json"], dir);
  assert.deepEqual(
    JSON.parse(ph.out).map((/** @type {{ id: string }} */ r) => r.id),
    ["CODE-ARCH-GRAPH", "CODE-DEADCODE", "CODE-DUP"],
  );
  const ph8 = cli(["rules", dir, "--phase", "8", "--json"], dir);
  assert.ok(
    JSON.parse(ph8.out).some((/** @type {{ id: string }} */ r) => r.id === "CODE-SHAPE"),
    "a rule of phase 7 / 8 is in phase 8",
  );
  const json = cli(["rules", dir, "--json"], dir);
  const list = JSON.parse(json.out);
  assert.equal(list.length, 77);
  assert.equal(list[0].check, undefined, "the function is not in the JSON");
  const nope = cli(["explain", "NOPE-1", dir], dir);
  assert.equal(nope.code, 2);
  assert.match(nope.out, /no rule NOPE-1/);
  const ex = cli(["explain", "code-deadcode", dir], dir);
  assert.equal(ex.code, 0, ex.out);
  assert.match(ex.out, /CODE-DEADCODE/);
  assert.match(ex.out, /insured by\s+hard/);
  assert.match(ex.out, /CODE\.6/, "the standard's id is namespaced (FAMILY.N)");
  assert.match(ex.out, /status\s+missing/);
});

test("docs/CATALOG.md is the catalog: abatty rules --md, committed", () => {
  const doc = readFileSync(new URL("../docs/CATALOG.md", import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  assert.equal(
    doc.trimEnd(),
    renderCatalogMarkdown(RULES).trimEnd(),
    "run: node bin/abatty.mjs rules --md > docs/CATALOG.md",
  );
});

test("the markdown report carries the level and the insurance of every check", () => {
  const dir = tempRepo("md", { "package.json": NEXT_PKG, "src/a.ts": "export const a = 1;\n" });
  const r = cli(["measure", dir, "--quiet"], dir);
  assert.equal(r.code, 0, r.out);
  const md = readFileSync(
    join(dir, "docs", `GAP_ANALYSIS_${new Date().toISOString().slice(0, 10)}.md`),
    "utf8",
  );
  assert.match(md, /\| ID \| Family \| Rule \| Level \| Insured by \| Status \|/);
  assert.match(md, /\| CODE-DEADCODE \| Code \| [^|]+ \| must \| hard \| \*\*missing\*\* \|/);
  assert.match(md, /abatty explain <ID>/);
});

test("the enforced share counts what the repository has by what insures it, and names what a night moves up", () => {
  /** @param {string} id @param {any} status @param {any} enforcement */
  const f = (id, status, enforcement) => ({
    id,
    family: "X",
    rule: id,
    status,
    evidence: "",
    next: "",
    phase: "0",
    level: /** @type {const} */ ("must"),
    enforcement,
    standard: [],
  });
  const e = enforcedOf([
    f("A", "present", "hard"),
    f("B", "present", "ratchet"),
    f("C", "partial", "review"),
    f("D", "present", "prose"),
    f("E", "missing", "prose"),
    f("F", "n/a", "hard"),
  ]);
  assert.equal(e.total, 4, "present and partial count; missing and n/a do not");
  assert.equal(e.share, 50);
  assert.deepEqual([e.hard, e.ratchet, e.review, e.prose], [1, 1, 1, 1]);
  assert.deepEqual(e.promotable, ["C", "D"]);
  assert.deepEqual(e.atCeiling, [], "no ceiling declared: nothing leaves the queue");
  assert.equal(enforcedOf([]).share, null);

  // The ceiling: a rule already as hard as any machine can hold it leaves the promotion queue,
  // and one still a level below its ceiling stays in it. A queue that never empties is ignored.
  const ceiling = /** @type {const} */ ({ at: "review", why: "a drill, not a scan" });
  const c = enforcedOf([
    { ...f("AT", "present", "review"), ceiling },
    { ...f("BELOW", "present", "prose"), ceiling },
    { ...f("FREE", "present", "review") },
    { ...f("HELD", "present", "hard"), ceiling },
  ]);
  assert.deepEqual(c.atCeiling, ["AT"]);
  assert.deepEqual(c.promotable, ["BELOW", "FREE"], "one step left, and one with no ceiling");
  assert.equal(c.share, 25, "the ceiling changes the queue, never the share");
  const out = cli(["rules", "--enforcement", "prose", "--json"], process.cwd()).out;
  assert.ok(JSON.parse(out).every((/** @type {any} */ r) => r.enforcement === "prose"));
});

test("every rule says which control it is: guide or sensor, computational or inferential", () => {
  // The category's published vocabulary. A guide is feedforward and steers before the agent acts;
  // a sensor is feedback and observes after it. Each is computational when a processor decides it
  // and inferential when a person or a model does. Feedback alone produces an agent that repeats
  // its mistakes and feedforward alone produces one that never learns whether its rules worked,
  // so the balance has to be readable rather than accidental.
  for (const r of RULES) {
    const c = controlOf(r);
    assert.ok(["guide", "sensor"].includes(c.control), `${r.id}: ${c.control}`);
    assert.ok(["computational", "inferential"].includes(c.basis), `${r.id}: ${c.basis}`);
  }
  // The derivation, in both directions.
  assert.deepEqual(controlOf(/** @type {any} */ ({ family: "Documents", enforcement: "prose" })), {
    control: "guide",
    basis: "inferential",
  });
  assert.deepEqual(controlOf(/** @type {any} */ ({ family: "Code", enforcement: "hard" })), {
    control: "sensor",
    basis: "computational",
  });
  assert.deepEqual(controlOf(/** @type {any} */ ({ family: "Code", enforcement: "review" })), {
    control: "sensor",
    basis: "inferential",
  });
  // A rule whose derivation is wrong for it says so itself.
  assert.deepEqual(
    controlOf(/** @type {any} */ ({ family: "Code", enforcement: "hard", control: "guide" })),
    { control: "guide", basis: "computational" },
  );
  // This catalog is sensor-heavy, which is the honest reading of a package built around a gate.
  const sensors = RULES.filter((r) => controlOf(r).control === "sensor").length;
  assert.ok(sensors > RULES.length / 2, `${sensors} of ${RULES.length}`);
});

test("a waiver is counted per rule: the rate, and a waiver that has run out is measured again and said out loud", async () => {
  const dir = tempRepo("waiver-rate", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
    "abatty.config.json": JSON.stringify({
      rules: {
        waived: {
          "DOC-ADR": { reason: "the decisions live in the wiki", until: "2999-01-01" },
          "DOC-CONVENTIONS": "no second stack to describe yet",
          "SEC-AUDIT": { reason: "was meant to be revisited", until: "2020-01-01" },
        },
      },
    }),
  });
  const catalog = await loadCatalog(dir, { today: "2026-09-19" });
  assert.deepEqual(catalog.problems, []);
  const findings = runCatalog(buildContext(dir), catalog.rules);
  const w = waiverOf(findings);

  assert.deepEqual(
    w.waived.map((f) => f.id).sort(),
    ["DOC-ADR", "DOC-CONVENTIONS"],
    "the live waivers, and not the one that ran out",
  );
  assert.equal(w.considered > 2, true);
  assert.equal(w.rate, Math.round((100 * 2) / w.considered));

  // the expired one is measured again rather than silently reverted, and keeps saying so
  const audit = findings.find((f) => f.id === "SEC-AUDIT");
  assert.notEqual(audit?.status, "waived", "an expired waiver does not waive");
  assert.equal(audit?.waiver?.expired, true);
  assert.equal(audit?.waiver?.until, "2020-01-01");
  assert.deepEqual(
    w.expired.map((f) => f.id),
    ["SEC-AUDIT"],
  );

  // the control in the other direction: a repository that waives nothing has a rate of zero
  const clean = tempRepo("waiver-none", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const none = waiverOf(runCatalog(buildContext(clean), (await loadCatalog(clean)).rules));
  assert.equal(none.rate, 0);
  assert.deepEqual(none.expired, []);

  const out = cli(["rules", dir], dir).out;
  assert.match(out, /waived: 2 of \d+ \(\d+%\)/);
  assert.match(out, /1 waiver\(s\) expired and measured again: SEC-AUDIT/);
});
