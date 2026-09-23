import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { advisoriesOf, auditOutcome, splitAllowances } from "../src/core/audit.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";

/** An npm audit --json report with one high and one low advisory. */
const REPORT = JSON.stringify({
  auditReportVersion: 2,
  vulnerabilities: {
    "tar-fs": {
      name: "tar-fs",
      severity: "high",
      via: [{ source: 1102541, title: "Link following", severity: "high" }],
    },
    tmp: {
      name: "tmp",
      severity: "low",
      via: [{ source: 1102545, title: "Symlink", severity: "low" }],
    },
  },
});

/** A repository with a lockfile, so the audit runs at all. @param {string} name */
function locked(name) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  writeFileSync(join(dir, "package-lock.json"), "{}\n");
  return dir;
}

/** A runner that answers the plain audit with `status` and the --json audit with the report. */
const runner =
  (status = 1, output = "found 1 high severity vulnerability", json = REPORT) =>
  (/** @type {string} */ _cmd, /** @type {string[]} */ args) =>
    args.includes("--json") ? { status: 1, output: json } : { status, output };

test("the audit is scoped to production dependencies and a severity floor before it refuses anything", () => {
  const dir = locked("audit-scope");
  /** @type {string[][]} */
  const calls = [];
  auditOutcome(dir, (_c, args) => {
    calls.push(args);
    return { status: 0, output: "" };
  });
  assert.deepEqual(calls[0], ["audit", "--audit-level=high", "--omit=dev"]);
  /** @type {string[][]} */
  const custom = [];
  auditOutcome(
    dir,
    (_c, args) => {
      custom.push(args);
      return { status: 0, output: "" };
    },
    { level: "critical" },
  );
  assert.deepEqual(custom[0], ["audit", "--audit-level=critical", "--omit=dev"]);
});

test("only the advisories at or above the floor are read from the report", () => {
  assert.deepEqual(
    (advisoriesOf(REPORT, "high") || []).map((a) => a.package),
    ["tar-fs"],
  );
  assert.deepEqual((advisoriesOf(REPORT, "low") || []).map((a) => a.package).sort(), [
    "tar-fs",
    "tmp",
  ]);
  assert.equal(advisoriesOf("not json", "high"), null);
  assert.deepEqual(advisoriesOf(REPORT, "high")?.[0]?.ids, ["1102541"]);
});

test("an allowance lets a named advisory through and says so; anything else still fails", () => {
  const dir = locked("audit-allow");
  const byName = auditOutcome(dir, runner(), {
    allow: [{ id: "tar-fs", reason: "no fix; not reachable from the shipped code" }],
  });
  assert.equal(byName.outcome, "ok");
  assert.match(byName.detail, /allowed: tar-fs \(high\)/);

  const byId = auditOutcome(dir, runner(), {
    allow: [{ id: "1102541", reason: "the advisory id works as well as the package" }],
  });
  assert.equal(byId.outcome, "ok");

  // the control in the other direction: an allowance for something else does not cover this one
  const elsewhere = auditOutcome(dir, runner(), {
    allow: [{ id: "left-pad", reason: "unrelated" }],
  });
  assert.equal(elsewhere.outcome, "failed");
  assert.match(elsewhere.detail, /tar-fs \(high\)/);
});

test("an allowance whose date has passed stops allowing, and the gate names the one that ran out", () => {
  const dir = locked("audit-expiry");
  const allow = [{ id: "tar-fs", reason: "waiting on the maintainer", until: "2020-01-01" }];
  assert.deepEqual(splitAllowances(allow, "2026-09-19").live, []);
  assert.deepEqual(splitAllowances(allow, "2019-01-01").live, allow);
  assert.deepEqual(splitAllowances([{ id: "x", reason: "r" }], "2026-09-19").expired, []);

  const r = auditOutcome(dir, runner(), { allow, today: "2026-09-19" });
  assert.equal(r.outcome, "failed", "an expired allowance allows nothing");
  assert.match(r.detail, /allowance\(s\) expired: tar-fs on 2020-01-01/);

  // and it is still named on a green run, so a decision nobody is reminded of is not forgotten
  const green = auditOutcome(dir, () => ({ status: 0, output: "" }), {
    allow,
    today: "2026-09-19",
  });
  assert.equal(green.outcome, "ok");
  assert.match(green.detail, /allowance\(s\) expired: tar-fs/);
});

test("the network is not a verdict; a repository with no lockfile is an instrument that cannot run, never a green step", () => {
  const dir = locked("audit-offline");
  assert.equal(
    auditOutcome(dir, () => ({ status: 1, output: "getaddrinfo EAI_AGAIN registry.npmjs.org" }))
      .outcome,
    "deferred",
  );
  // an advisory title that talks about a network is a finding, not an outage
  assert.equal(
    auditOutcome(dir, runner(1, "high  Server-side request forgery over the network")).outcome,
    "failed",
  );
  // This read "skipped" once, and the gate counts a skipped step as passed: a product with
  // seventy advisories and no package-lock.json had a gate that said nothing about them.
  const bare = tempRepo("audit-nolock", { "package.json": NEXT_PKG });
  const r = auditOutcome(bare, () => ({ status: 0, output: "" }));
  assert.equal(r.outcome, "errored");
  assert.match(r.detail, /no lockfile/);
});

/** pnpm's report, as `pnpm audit --json --prod` printed it on 2026-09-21 for tar-fs 2.1.1. */
const PNPM_REPORT = JSON.stringify({
  actions: [],
  advisories: {
    1109532: {
      id: 1109532,
      module_name: "tar-fs",
      severity: "high",
      title: "tar-fs has a symlink validation bypass",
      github_advisory_id: "GHSA-vj76-c3g6-qr5v",
    },
    1109533: { id: 1109533, module_name: "tmp", severity: "low", title: "Symlink" },
  },
  muted: [],
  metadata: { vulnerabilities: { high: 1, low: 1 } },
});
/** bun's report, as `bun audit --json --prod` printed it the same day, its banner included. */
const BUN_REPORT =
  "bun audit v1.3.13 (bf2e2cec)\n" +
  JSON.stringify({
    "tar-fs": [
      {
        id: 1109532,
        url: "https://github.com/advisories/GHSA-vj76-c3g6-qr5v",
        title: "tar-fs has a symlink validation bypass",
        severity: "high",
      },
    ],
    tmp: [{ id: 1109533, title: "Symlink", severity: "low" }],
  });

test("the audit is the package manager's, not npm's: pnpm and bun are run and their reports read", () => {
  const pnpm = tempRepo("audit-pnpm", {
    "package.json": NEXT_PKG,
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  });
  /** @type {string[][]} */
  const calls = [];
  const r = auditOutcome(
    pnpm,
    (cmd, args) => {
      calls.push([cmd, ...args]);
      return args.includes("--json")
        ? { status: 1, output: PNPM_REPORT }
        : { status: 1, output: "1 high" };
    },
    { allow: [{ id: "tar-fs", reason: "no fix yet" }] },
  );
  assert.deepEqual(calls[0], ["pnpm", "audit", "--audit-level=high", "--prod"]);
  assert.deepEqual(calls[1], ["pnpm", "audit", "--json", "--prod"]);
  assert.equal(r.outcome, "ok", r.detail);
  assert.match(r.detail, /allowed: tar-fs \(high\)/);
  assert.deepEqual(
    advisoriesOf(PNPM_REPORT, "high")?.map((a) => [a.package, a.ids]),
    [["tar-fs", ["1109532"]]],
  );

  const bun = tempRepo("audit-bun", { "package.json": NEXT_PKG, "bun.lock": "{}\n" });
  const b = auditOutcome(
    bun,
    (cmd, args) =>
      args.includes("--json") ? { status: 1, output: BUN_REPORT } : { status: 1, output: "1 high" },
    { allow: [{ id: "left-pad", reason: "unrelated: the report is read and tar-fs is left" }] },
  );
  assert.equal(b.outcome, "failed", "nothing allows it: the high advisory fails the step");
  assert.match(b.detail, /tar-fs \(high\)/);
  assert.deepEqual(
    advisoriesOf(BUN_REPORT, "low")
      ?.map((a) => a.package)
      .sort(),
    ["tar-fs", "tmp"],
  );
});

// Recorded on 2026-09-23 from real runs against lodash 4.17.20 (yarn 1.22.22 and yarn 4.5.0),
// trimmed to the fields read.
const YARN1_HIGH = [
  '{"type":"auditAdvisory","data":{"advisory":{"module_name":"lodash","severity":"high","id":1106913,"github_advisory_id":"GHSA-35jh-r3h4-6jhm","title":"Command Injection in lodash"}}}',
  '{"type":"auditSummary","data":{"vulnerabilities":{"info":0,"low":0,"moderate":3,"high":2,"critical":0}}}',
].join("\n");
const YARN1_NONE =
  '{"type":"auditSummary","data":{"vulnerabilities":{"info":0,"low":0,"moderate":3,"high":0,"critical":0}}}\n';
const BERRY_HIGH =
  '{"value":"lodash","children":{"ID":1106913,"Issue":"Command Injection in lodash","Severity":"high"}}\n';

test("yarn 1 is judged from its report, never its exit code, which ignores the floor", () => {
  const dir = tempRepo("audit-yarn1", {
    "package.json": NEXT_PKG,
    "yarn.lock": "# yarn lockfile v1\n",
  });
  // exit 12 is moderate + high as a bitmask; with only moderates reported at --level high it is
  // still non-zero, and reading it would fail a clean step
  const clean = auditOutcome(dir, () => ({ status: 12, output: YARN1_NONE }));
  assert.equal(clean.outcome, "ok", clean.detail);
  const high = auditOutcome(dir, () => ({ status: 12, output: YARN1_HIGH }));
  assert.equal(high.outcome, "failed");
  const allowed = auditOutcome(dir, () => ({ status: 12, output: YARN1_HIGH }), {
    allow: [{ id: "GHSA-35jh-r3h4-6jhm", reason: "the template function is not called" }],
  });
  assert.equal(allowed.outcome, "ok", "the advisory's id allows it, read off the same report");
  assert.equal(
    auditOutcome(dir, () => ({ status: 1, output: "error An unexpected error occurred" })).outcome,
    "failed",
    "an unreadable report is never a clean one",
  );
  // an advisory about a network, even one quoting a connection error, is an advisory and not an
  // unreachable registry: this read "deferred", which the gate counts as a pass
  const networky = YARN1_HIGH.replace(
    '"title":"Command Injection in lodash"',
    '"title":"An attacker on the network forces ECONNRESET"',
  );
  assert.equal(auditOutcome(dir, () => ({ status: 8, output: networky })).outcome, "failed");
  // and a real outage still defers
  assert.equal(
    auditOutcome(dir, () => ({
      status: 1,
      output: "error getaddrinfo ENOTFOUND registry.yarnpkg.com",
    })).outcome,
    "deferred",
  );
});

test("yarn berry's exit code honours the floor, and its line-per-advisory report is read for allowances", () => {
  const lock = '# This file is generated by running "yarn install"\n\n__metadata:\n  version: 8\n';
  const dir = tempRepo("audit-berry", { "package.json": NEXT_PKG, "yarn.lock": lock });
  assert.equal(auditOutcome(dir, () => ({ status: 0, output: "" })).outcome, "ok");
  const run = (/** @type {string} */ _c, /** @type {string[]} */ args) =>
    args.includes("--json") ? { status: 1, output: BERRY_HIGH } : { status: 1, output: "high" };
  assert.equal(auditOutcome(dir, run).outcome, "failed");
  assert.equal(auditOutcome(dir, run, { allow: [{ id: "lodash", reason: "r" }] }).outcome, "ok");
  assert.deepEqual(advisoriesOf(BERRY_HIGH, "critical"), []);
});

test("SEC-AUDIT reads for the scoping, not for the word: an unscoped audit is partial", () => {
  /** @param {Record<string, string>} files */
  const find = (files) => {
    const dir = tempRepo(
      "audit-rule-" + Object.keys(files).length + Math.random().toString(36).slice(2, 7),
      {
        "package.json": NEXT_PKG,
        ...files,
      },
    );
    const f = runCatalog(buildContext(dir), RULES).find((x) => x.id === "SEC-AUDIT");
    assert.ok(f, "SEC-AUDIT is in the catalog");
    return f;
  };
  const wf = (/** @type {string} */ run) => ({
    ".github/workflows/ci.yml": `jobs:\n  a:\n    steps:\n      - run: ${run}\n`,
  });

  assert.equal(find({}).status, "missing");
  const bare = find(wf("npm audit"));
  assert.equal(bare.status, "partial");
  assert.match(bare.evidence, /unscoped on production scoping and a severity floor/);
  assert.equal(find(wf("npm audit --omit=dev")).status, "partial");
  const scoped = find(wf("npm audit --omit=dev --audit-level=high"));
  assert.equal(scoped.status, "present");
  assert.match(scoped.evidence, /production only, a severity floor/);
  // a repository whose CI runs the gate has the built-in audit, which is scoped by construction
  const viaGate = find(wf("npx abatty gate"));
  assert.equal(viaGate.status, "present");
  assert.match(viaGate.evidence, /built-in audit/);
});
