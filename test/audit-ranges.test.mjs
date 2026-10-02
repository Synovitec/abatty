import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { advisoriesOf, auditOutcome, describeAdvisory } from "../src/core/audit.mjs";

// The gate printed one line per package. brace-expansion was affected in three majors at once,
// each needing its own fix, and an adopter learnt that only by asking the manager again.

const NPM = JSON.stringify({
  vulnerabilities: {
    "brace-expansion": {
      severity: "high",
      via: [
        { source: 1, title: "ReDoS", range: "<1.1.20" },
        { source: 2, title: "ReDoS", range: ">=2.0.0 <2.1.5" },
        { source: 3, title: "ReDoS", range: ">=5.0.0 <5.0.11" },
      ],
      nodes: [
        "node_modules/brace-expansion",
        "node_modules/minimatch/node_modules/brace-expansion",
        "node_modules/glob/node_modules/brace-expansion",
      ],
    },
  },
});

const BUN = JSON.stringify({
  "brace-expansion": [
    { id: 1, severity: "high", title: "ReDoS", vulnerable_versions: "<1.1.20" },
    { id: 2, severity: "high", title: "ReDoS", vulnerable_versions: ">=2.0.0 <2.1.5" },
  ],
});

test("every affected range and every installed copy is read, npm and bun alike", () => {
  const [npm] = advisoriesOf(NPM, "high") || [];
  assert.deepEqual(npm?.ranges, ["<1.1.20", ">=2.0.0 <2.1.5", ">=5.0.0 <5.0.11"]);
  assert.deepEqual(npm?.installed, [
    "brace-expansion",
    "minimatch > brace-expansion",
    "glob > brace-expansion",
  ]);
  const [bun] = advisoriesOf(BUN, "high") || [];
  assert.deepEqual(bun?.ranges, ["<1.1.20", ">=2.0.0 <2.1.5"]);
  const said = describeAdvisory(/** @type {any} */ (npm));
  assert.match(said, /affected: <1\.1\.20, >=2\.0\.0 <2\.1\.5, >=5\.0\.0 <5\.0\.11/);
  assert.match(
    said,
    /installed: brace-expansion; minimatch > brace-expansion; glob > brace-expansion/,
  );
});

test("a failing audit with nothing allowed prints every range, not the summary's last lines", () => {
  const dir = tempRepo("audit-ranges", {
    "package.json": JSON.stringify({ name: "a" }),
    "package-lock.json": '{ "lockfileVersion": 3 }\n',
  });
  const run = (/** @type {string} */ _c, /** @type {string[]} */ args) =>
    args.includes("--json")
      ? { status: 1, output: NPM }
      : { status: 1, output: "brace-expansion  *\nSeverity: high\n1 high severity vulnerability" };
  const r = auditOutcome(dir, run);
  assert.equal(r.outcome, "failed");
  assert.match(r.detail, /affected: <1\.1\.20, >=2\.0\.0 <2\.1\.5, >=5\.0\.0 <5\.0\.11/);
  // A report that does not parse leaves the tool's own lines, as before.
  const bare = auditOutcome(dir, () => ({ status: 1, output: "1 high severity vulnerability" }));
  assert.match(bare.detail, /1 high severity vulnerability/);
});
