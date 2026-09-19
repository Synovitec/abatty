/**
 * A tool that only refuses is half a tool. What `fix` writes has to satisfy the rules the
 * repository already has, or it trades one finding for another - the failure a fixer must never
 * have - and it must not write anything without being asked twice.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { applyFix, planFix } from "../src/core/fix.mjs";

/** @param {string} name */
const repo = (name) =>
  tempRepo(name, {
    "package.json": JSON.stringify({ name: "app", private: true }),
    "docs/README.md":
      "# Index\n\n| Document | What it is for | Category | Status |\n| --- | --- | --- | --- |\n| `OTHER.md` | something | guide | living |\n",
    "docs/OTHER.md": "---\ntitle: T\ndescription: D\ncategory: guide\nstatus: living\n---\n\n# T\n",
  });

/** @param {string} id @param {string} phase */
const missing = (id, phase) =>
  /** @type {any} */ ({ id, phase, status: "missing", evidence: "none" });

test("the plan names what it would write and why, and writes nothing", () => {
  const dir = repo("fix-plan");
  const steps = planFix({
    repoDir: dir,
    findings: [missing("DOC-CONVENTIONS", "A.1"), missing("DOC-ADR", "A.1")],
    phase: "A.1",
    name: "app",
    date: "2026-09-19",
  });
  assert.deepEqual(
    steps.map((s) => [s.rule, s.action]),
    [
      ["DOC-CONVENTIONS", "write"],
      ["DOC-ADR", "write"],
    ],
  );
  assert.ok(steps.every((s) => s.why.length > 40));
  assert.equal(existsSync(join(dir, "docs/CODE_CONVENTIONS.md")), false, "the plan writes nothing");

  // A rule of another phase is not this phase's work.
  const other = planFix({
    repoDir: dir,
    findings: [missing("DOC-CONVENTIONS", "11")],
    phase: "A.1",
    name: "app",
    date: "2026-09-19",
  });
  assert.deepEqual(other, []);
});

test("what it writes carries front matter and its row in the index, so no finding is traded for another", () => {
  const dir = repo("fix-write");
  const steps = planFix({
    repoDir: dir,
    findings: [missing("DOC-CONVENTIONS", "A.1"), missing("DOC-ADR", "A.1")],
    phase: "A.1",
    name: "app",
    date: "2026-09-19",
  });
  const written = applyFix(dir, steps);
  assert.ok(written.includes("docs/CODE_CONVENTIONS.md"));
  assert.ok(written.includes("docs/decisions/0001-record-decisions.md"));
  assert.ok(written.includes("docs/README.md"), "the index moves with the tree");
  for (const p of ["docs/CODE_CONVENTIONS.md", "docs/decisions/0001-record-decisions.md"]) {
    const text = readFileSync(join(dir, p), "utf8");
    assert.match(text, /^---\ntitle: /, p);
    assert.match(text, /last_verified: "2026-09-19"/, p);
    assert.match(text, /^status: living$/m, p);
  }
  const index = readFileSync(join(dir, "docs/README.md"), "utf8");
  assert.match(index, /CODE_CONVENTIONS\.md/);
  assert.match(index, /decisions\/0001-record-decisions\.md/);

  // Run twice: what is already there is held, not rewritten.
  const again = planFix({
    repoDir: dir,
    findings: [missing("DOC-CONVENTIONS", "A.1")],
    phase: "A.1",
    name: "app",
    date: "2026-09-19",
  });
  assert.deepEqual(
    again.map((s) => s.action),
    ["held"],
  );
  assert.deepEqual(applyFix(dir, again), [], "nothing is written over");
});

test("the command shows the plan by default and needs --write to touch anything", () => {
  const dir = repo("fix-cli");
  const plan = cli(["fix", dir, "--phase", "A.1"], dir);
  assert.equal(plan.code, 0, plan.out);
  assert.match(plan.out, /would be written/);
  assert.match(plan.out, /Nothing was touched/);
  assert.equal(existsSync(join(dir, "docs/CODE_CONVENTIONS.md")), false);

  const wrote = cli(["fix", dir, "--phase", "A.1", "--write"], dir);
  assert.equal(wrote.code, 0, wrote.out);
  assert.match(wrote.out, /written docs\/CODE_CONVENTIONS\.md/);
  assert.equal(existsSync(join(dir, "docs/CODE_CONVENTIONS.md")), true);

  // And the rule it was written for now holds, proven by the command a finding names.
  assert.equal(cli(["check", "DOC-ADR", dir], dir).code, 0);
  assert.equal(cli(["check", "DOC-CONVENTIONS", dir], dir).code, 0);
});
