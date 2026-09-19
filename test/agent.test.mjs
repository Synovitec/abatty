/**
 * The loop the package exists to close: the rule breaks, the gate refuses with an instruction,
 * the agent edits, the agent runs `verify`, and no human is involved until something does not
 * converge. The case that matters is the last step - `verify` has to be wrong before the edit and
 * right after it, or the agent is guessing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { agentFinding, agentFindings, verifyCommand, whereOf } from "../src/rules/agent.mjs";

test("verify is non-zero before the edit and zero after it", () => {
  const dir = tempRepo("agent-verify", {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "src/index.mjs": "export const a = 1;\n",
  });
  // Before: the rule does not hold, and the command a finding names says so with exit 3.
  const before = cli(["check", "DOC-CHANGELOG", dir], dir);
  assert.equal(before.code, 3, before.out);
  assert.match(before.out, /DOC-CHANGELOG (missing|partial)/);

  // The edit the finding asked for, and nothing else.
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# Changelog\n\nKeep a Changelog, SemVer.\n\n## [Unreleased]\n\n### Added\n\n- a line\n",
  );

  // After: the same command, the same rule, exit 0. Nothing else in the repository changed.
  const after = cli(["check", "DOC-CHANGELOG", dir], dir);
  assert.equal(after.code, 0, after.out);
  assert.match(after.out, /DOC-CHANGELOG present/);

  // The control in the other direction: a rule that still does not hold still exits 3.
  assert.equal(cli(["check", "DOC-ADR", dir], dir).code, 3);
  // And a name that is not a rule is bad input, not a finding.
  assert.equal(cli(["check", "NOT-A-RULE", dir], dir).code, 2);
});

test("a finding carries where, what, verify and why, and only the open ones are returned", () => {
  /** @type {any} */
  const findings = [
    {
      id: "CODE-SIZE-300",
      family: "Code",
      rule: "r",
      status: "partial",
      evidence: "2 file(s): bin/abatty.mjs (646), src/x.mjs (301)",
      next: "Split the file by what each piece is for",
      phase: "7",
      level: "must",
      enforcement: "ratchet",
      standard: ["CODE.1"],
    },
    {
      id: "CODE-FORMAT",
      family: "Code",
      rule: "r",
      status: "present",
      evidence: "prettier",
      next: "",
      phase: "1",
      level: "must",
      enforcement: "hard",
      standard: [],
    },
  ];
  const rules = /** @type {any} */ ([{ id: "CODE-SIZE-300", why: "because a file has a budget" }]);
  const open = agentFindings(findings, rules);
  assert.deepEqual(
    open.map((f) => f.id),
    ["CODE-SIZE-300"],
    "what already holds is not work",
  );
  const [f] = open;
  assert.ok(f);
  assert.deepEqual(f.where, { path: "bin/abatty.mjs" });
  assert.equal(f.what, "Split the file by what each piece is for");
  assert.equal(f.verify, "npx abatty check CODE-SIZE-300");
  assert.equal(f.why, "because a file has a budget");
});

test("where reads a path and a line out of the evidence, and says nothing when there is none", () => {
  assert.deepEqual(whereOf("src/core/gate.mjs · 301 code lines"), { path: "src/core/gate.mjs" });
  assert.deepEqual(whereOf("src/a.ts:42 something"), { path: "src/a.ts", line: 42 });
  assert.equal(whereOf("no logging dependency and no logger module"), null);
  assert.equal(whereOf(""), null);
  assert.equal(verifyCommand("X-1"), "npx abatty check X-1");
  const one = agentFinding(
    /** @type {any} */ ({ id: "X-1", status: "missing", evidence: "none", next: "do it" }),
  );
  assert.equal(one.why, "", "a rule with no reason to hand still produces a usable finding");
});
