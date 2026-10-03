import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { stepSummary } from "../src/cli/step-summary.mjs";

// An outside review found the gate invisible where a pull request is decided: SARIF marks the
// lines, nothing said whether the gate held. The verdict goes on the run's page now.

test("the summary is a headline and one row per step, with a pipe in a detail kept in its cell", () => {
  const md = stepSummary("red", [
    { label: "format", outcome: "ok", ms: 1 },
    { label: "unit tests (TEST.1)", outcome: "failed", detail: "a | b" },
  ]);
  assert.match(md, /^### abatty gate: red$/m);
  assert.match(md, /^\| ✅ \| format \| ok \| {2}\|$/m);
  assert.match(md, /^\| ❌ \| unit tests \(TEST\.1\) \| failed \| a \\\| b \|$/m);
});

test("the gate writes its verdict where GITHUB_STEP_SUMMARY points, and nowhere without it", () => {
  const dir = tempRepo("step-summary", {
    "package.json": JSON.stringify({ name: "s", private: true }),
  });
  const file = join(mkdtempSync(join(tmpdir(), "abatty-summary-")), "summary.md");
  cli(["gate", dir, "--fast", "--stack", "node"], dir, { GITHUB_STEP_SUMMARY: file });
  const once = readFileSync(file, "utf8");
  assert.match(once, /^### abatty gate: (green|red|could not run)/m);
  // Unset, nothing is appended anywhere: the file the last run wrote is as it was.
  cli(["gate", dir, "--fast", "--stack", "node"], dir, { GITHUB_STEP_SUMMARY: "" });
  assert.equal(readFileSync(file, "utf8"), once);
  assert.equal(existsSync(join(dir, "summary.md")), false);
});
