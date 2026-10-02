import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { auditAttribution } from "../src/core/audit.mjs";
import { runGate } from "../src/core/gate.mjs";

// A red audit read the same whoever brought the advisory in. An adopter whose push touched only
// lint scripts and docs took five advisories published since its last green push for the push's.

/** A repository with a lockfile, and the commit to judge from. */
function repo() {
  const dir = tempRepo("audit-whose", {
    "package.json": JSON.stringify({ name: "a", dependencies: { left: "1" } }),
    "package-lock.json": '{ "lockfileVersion": 3 }\n',
  });
  return { dir, base: git(dir, "rev-parse", "HEAD") };
}

test("a push that changed neither the manifest nor the lockfile did not bring the advisories in", () => {
  const { dir, base } = repo();
  writeFileSync(join(dir, "README.md"), "# a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: readme");
  assert.match(
    auditAttribution(dir, `${base}..HEAD`),
    /changed neither package\.json nor package-lock\.json: these advisories are against dependencies already on the base/,
  );
});

test("a push that changed the lockfile is named as one that may have brought them in", () => {
  const { dir, base } = repo();
  writeFileSync(join(dir, "package-lock.json"), '{ "lockfileVersion": 3, "x": 1 }\n');
  git(dir, "commit", "-q", "-am", "chore: bump");
  assert.match(
    auditAttribution(dir, `${base}..HEAD`),
    /this push changed package-lock\.json: an advisory above may be one it brought in/,
  );
  assert.equal(auditAttribution(dir, ""), "", "no range, no claim");
});

test("the gate's red audit says whose the advisories are", () => {
  const { dir, base } = repo();
  writeFileSync(join(dir, "README.md"), "# a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: readme");
  /** @type {string[]} */
  const said = [];
  const r = runGate({
    repoDir: dir,
    preset: /** @type {import("../src/presets/index.mjs").Preset} */ (
      /** @type {unknown} */ ({
        id: "a",
        gate: { always: [{ label: "audit (SEC.1)", builtin: "audit" }], suites: [] },
      })
    ),
    range: `${base}..HEAD`,
    log: (l) => said.push(l),
    audit: () => ({
      status: 1,
      output: "left  <1.2.0\nSeverity: high\n1 high severity vulnerability",
    }),
  });
  assert.equal(r.ok, false);
  assert.match(said.join("\n"), /already on the base/);
});
