/**
 * SARIF is the surface that reaches a reviewer where the evidence says it matters: on the diff.
 * These cases hold the shape a forge parses, the level a rule's enforcement maps to, and the
 * identity of a finding across runs, which is the thing the ratchet solves by hand today.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint, sarifLevel, sarifOfFindings, sarifOfVerdicts } from "../src/ui/sarif.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { agentFinding } from "../src/rules/agent.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { NEXT_PKG, tempRepo } from "./helpers.mjs";

/** @param {Partial<import("../src/rules/index.mjs").Finding>} f @returns {import("../src/rules/index.mjs").Finding} */
const finding = (f) => ({
  .../** @type {import("../src/rules/index.mjs").Finding} */ ({}),
  id: "X-1",
  family: "Code",
  rule: "a rule",
  status: /** @type {const} */ ("missing"),
  evidence: "none",
  next: "do the thing",
  phase: "1",
  level: /** @type {const} */ ("must"),
  enforcement: /** @type {const} */ ("hard"),
  standard: ["CODE.1"],
  ...f,
});

test("the log is the shape a forge parses, and only open findings are results", () => {
  const log = sarifOfFindings({
    version: "9.9.9",
    findings: [
      finding({ id: "A-1" }),
      finding({ id: "A-2", status: "partial" }),
      finding({ id: "A-3", status: "present" }),
      finding({ id: "A-4", status: "n/a" }),
      finding({ id: "A-5", status: "waived" }),
    ],
  });
  assert.equal(log.version, "2.1.0");
  assert.match(log.$schema, /sarif-2\.1\.0/);
  assert.equal(log.runs.length, 1);
  const run = log.runs[0];
  assert.ok(run);
  assert.equal(run.tool.driver.name, "abatty");
  assert.equal(run.tool.driver.version, "9.9.9");
  assert.deepEqual(
    run.results.map((r) => r.ruleId),
    ["A-1", "A-2"],
    "present, n/a and waived are not findings",
  );
  // Every result names a rule the log declares: a forge drops a result whose rule it cannot find.
  const declared = new Set(run.tool.driver.rules.map((r) => r.id));
  for (const r of run.results) assert.ok(declared.has(r.ruleId), r.ruleId);
});

test("enforcement decides the level, and a ratchet is an error only when the number rose", () => {
  assert.equal(sarifLevel("hard"), "error");
  assert.equal(sarifLevel("review"), "warning");
  assert.equal(sarifLevel("prose"), "note");
  // The promise a ratchet makes is about the direction, not the value.
  assert.equal(sarifLevel("ratchet", false), "warning");
  assert.equal(sarifLevel("ratchet", true), "error");
});

test("a probe finding carries the line it concerns, which is what puts it on the diff", () => {
  const probes = [
    {
      metric: "size.overBudget",
      title: "Files over the budget",
      why: "why",
      standard: ["CODE.1"],
      axis: "readability",
    },
  ];
  const log = sarifOfVerdicts({
    version: "1.0.0",
    probes: /** @type {any} */ (probes),
    verdicts: /** @type {any} */ ([
      {
        metric: "size.overBudget",
        kind: "hard",
        status: "hard-fail",
        value: 1,
        floor: 0,
        scanned: 9,
        messages: [],
        findings: [{ path: "src/big.mjs", line: 301, detail: "301 code lines > 300" }],
      },
      {
        metric: "quiet",
        kind: "ratchet",
        status: "ok",
        value: 0,
        floor: 0,
        scanned: 3,
        messages: [],
        findings: [],
      },
    ]),
  });
  const run = log.runs[0];
  assert.ok(run);
  assert.equal(run.results.length, 1, "a verdict with no findings is not a result");
  const r = run.results[0];
  assert.ok(r);
  assert.equal(r.level, "error", "a hard metric that failed is an error");
  const loc = /** @type {any} */ (r.locations)[0].physicalLocation;
  assert.equal(loc.artifactLocation.uri, "src/big.mjs");
  assert.equal(loc.region.startLine, 301);
  assert.match(r.message.text, /301 code lines > 300/);
  assert.match(r.message.text, /floor 0, now 1/);
});

test("the fingerprint follows the finding, not the line it happens to sit on", () => {
  // partialFingerprints exists so a finding survives the lines above it moving. Keyed on the path
  // and the detail, an inserted import does not turn every finding in the file into a new one.
  const a = fingerprint(["size.overBudget", "src/big.mjs", "301 code lines > 300"]);
  const b = fingerprint(["size.overBudget", "src/big.mjs", "301 code lines > 300"]);
  const other = fingerprint(["size.overBudget", "src/other.mjs", "301 code lines > 300"]);
  assert.equal(a, b);
  assert.notEqual(a, other);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test("a ratchet finding lands on its line, and findings that share a file stay distinct", () => {
  /** @type {any} */
  const verdict = {
    metric: "valid.rawEnv",
    kind: "ratchet",
    status: "regressed",
    value: 3,
    floor: 1,
    scanned: 2,
    messages: [],
    findings: [
      { path: "src/a.ts", line: 22, detail: "raw process.env read" },
      { path: "src/a.ts", line: 23, detail: "raw process.env read" },
      { path: "src/b.ts", detail: "a finding about the file, not a line" },
    ],
  };
  const probe = {
    metric: "valid.rawEnv",
    kind: "ratchet",
    title: "t",
    why: "w",
    standard: [],
    scan: () => ({ scanned: 0, findings: [] }),
    controls: [],
  };
  const log = sarifOfVerdicts({
    verdicts: [verdict],
    probes: /** @type {any} */ ([probe]),
    version: "9.9.9",
  });
  const results = /** @type {any[]} */ (log.runs[0]?.results);
  assert.equal(results.length, 3);

  // The line is what puts a finding on the diff of the change under review rather than at the
  // top of the file, which was the whole argument for emitting SARIF at all.
  assert.equal(results[0].locations[0].physicalLocation.region.startLine, 22);
  assert.equal(results[1].locations[0].physicalLocation.region.startLine, 23);
  assert.equal(
    results[2].locations[0].physicalLocation.region,
    undefined,
    "a finding about a file carries no region rather than a made-up line",
  );

  // Two findings in one file with the same text are two alerts, not one.
  const fps = results.map((/** @type {any} */ r) => r.partialFingerprints.abattyFinding);
  assert.equal(new Set(fps).size, 3, "colliding fingerprints would dedupe them into one alert");

  // ...and the fingerprint survives an unrelated line being inserted above, which is what a
  // partial fingerprint is for. Same findings, different lines, same identities.
  const moved = /** @type {any} */ (JSON.parse(JSON.stringify(verdict)));
  moved.findings[0].line = 40;
  moved.findings[1].line = 41;
  const after = sarifOfVerdicts({
    verdicts: [moved],
    probes: /** @type {any} */ ([probe]),
    version: "9.9.9",
  }).runs[0]?.results.map((/** @type {any} */ r) => r.partialFingerprints.abattyFinding);
  assert.deepEqual(after, fps);
});

test("a catalog finding is placed by the `where` it carries, and the renderer invents none", () => {
  /** @param {string} id @param {string} evidence @param {{path:string,line?:number}} [where] */
  const finding = (id, evidence, where) => ({
    ...(where ? { where } : {}),
    id,
    family: "Code",
    rule: id,
    status: /** @type {const} */ ("missing"),
    evidence,
    next: "n",
    phase: "0",
    level: /** @type {const} */ ("must"),
    enforcement: /** @type {const} */ ("hard"),
    standard: [],
  });
  const log = sarifOfFindings({
    findings: [
      finding("A-ONE", "1 file(s): src/big.ts (425)", { path: "src/big.ts" }),
      finding("A-TWO", "nothing reports a bypassed commit"),
    ],
    version: "9.9.9",
  });
  const [first, second] = /** @type {any[]} */ (log.runs[0]?.results);
  // src/ui/ renders what it is given, which the import graph enforces: the renderer may not
  // reach into the rules to work a location out for itself.
  assert.equal(first?.locations[0].physicalLocation.artifactLocation.uri, "src/big.ts");
  assert.equal(second?.locations, undefined, "given none, it invents none");
});

test("runCatalog attaches `where` once, so every surface places a finding the same way", () => {
  const dir = tempRepo("where-once", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const findings = runCatalog(buildContext(dir), RULES);
  const located = findings.filter((f) => f.where);
  assert.ok(located.length > 0, "some evidence names a file");
  for (const f of located) assert.match(String(f.where?.path), /\.\w+$/);

  // The MCP surface and the SARIF renderer now read the same field rather than each deciding.
  const sample = located[0];
  assert.ok(sample);
  assert.deepEqual(agentFinding(sample).where, sample.where);
});
