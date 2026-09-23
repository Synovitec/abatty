import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { prerequisites } from "../src/core/prereqs.mjs";

// Program names nobody has on PATH, so the answer is the fixture's and never the machine's.
const HERE = "abatty-tool-here-__";
const GONE = "abatty-tool-gone-__";

/** @type {import("../src/presets/index.mjs").Preset} */
const PRESET = /** @type {any} */ ({
  id: "fixture",
  gate: {
    always: [
      { label: "installed", script: "a" },
      { label: "not installed", script: "b" },
      { label: "optional, absent", script: "c" },
      { label: "required, absent", script: "d", required: true },
      { label: "needs a config", script: "a", requires: ["tool.config.json"] },
      { label: "a command", command: ["npx", GONE, "--check"] },
      { label: "audit", builtin: "audit" },
      { label: "secrets", builtin: "secrets" },
    ],
    suites: [
      { name: "db", paths: /^db\//, docker: true, steps: [{ label: "suite", script: "a" }] },
    ],
  },
});

/** @param {string} name @param {Record<string, string>} [extra] */
function fixture(name, extra = {}) {
  return tempRepo(name, {
    "package.json": JSON.stringify({ scripts: { a: `${HERE} run`, b: `CI=1 ${GONE} .` } }),
    [`node_modules/.bin/${HERE}`]: "",
    ...extra,
  });
}

test("each step reads ready, missing or off from what the repository has, with nothing run", () => {
  const dir = fixture("prereqs");
  const by = Object.fromEntries(
    prerequisites(dir, PRESET, { dockerUp: () => false }).map((p) => [p.label, p]),
  );
  assert.equal(by.installed?.state, "ready");
  assert.equal(by["not installed"]?.state, "missing");
  assert.match(by["not installed"]?.detail || "", new RegExp(`${GONE}, which is not installed`));
  assert.equal(by["optional, absent"]?.state, "off", "an optional step not configured is skipped");
  assert.equal(by["required, absent"]?.state, "missing", "a required one cannot be");
  assert.equal(by["needs a config"]?.state, "off");
  assert.equal(by["a command"]?.state, "missing");
  assert.equal(by.audit?.state, "missing", "no lockfile, nothing to audit");
  assert.equal(by.secrets?.state, "ready");
  assert.equal(by["db: suite"]?.state, "ready");
  assert.equal(by["db: the database"]?.state, "missing", "docker does not answer");
});

test("a lockfile readies the audit, a config readies its step, and Plug'n'Play is never judged", () => {
  const dir = fixture("prereqs-ready", {
    "package-lock.json": "{}",
    "tool.config.json": "{}",
    ".pnp.cjs": "",
  });
  const by = Object.fromEntries(
    prerequisites(dir, PRESET, { dockerUp: () => true }).map((p) => [p.label, p]),
  );
  assert.equal(by.audit?.state, "ready");
  assert.equal(by["needs a config"]?.state, "ready");
  assert.equal(by["not installed"]?.state, "ready", "under PnP the manager resolves the tool");
  assert.equal(by["db: the database"], undefined);
});

test("gate --preflight exits 4 when a configured step cannot run, and runs nothing", () => {
  const dir = tempRepo("prereqs-cli", {
    "package.json": JSON.stringify({ scripts: { test: `${GONE} run`, standards: "node -v" } }),
  });
  writeFileSync(join(dir, "package-lock.json"), "{}");
  const r = cli(["gate", dir, "--preflight", "--stack", "node"], dir);
  assert.equal(r.code, 4, r.out);
  assert.match(r.out, /unit tests \(TEST\.1\) \(required\)\s+· "test" runs abatty-tool-gone-__/);
  assert.doesNotMatch(r.out, /▶/, "no step ran");
});
