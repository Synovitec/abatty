import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { PRIMARY } from "../src/agents/index.mjs";

// Six outside reviews met thirty-six files, an agent harness and a dozen documents before a
// single check bit. A new repository now starts on the minimal profile (decision 0002, the 1.0
// scope); the synovitec setup is one flag away, and a repository already configured keeps it.

const PKG = JSON.stringify({ name: "fresh", scripts: { test: "node --test" } });
const config = (/** @type {string} */ dir) =>
  JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8"));

test("a new repository gets the minimal profile: the gate and its hooks, no harness, no standard's documents", () => {
  const dir = tempRepo("minimal-fresh", {
    "package.json": PKG,
    "index.js": "module.exports = 1;\n",
  });
  const r = cli(["init", dir, "--yes"], dir);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(config(dir).profiles, ["minimal"]);
  assert.deepEqual(config(dir).changelogRequiredFor, [], "no changelog line per commit");
  assert.ok(existsSync(join(dir, ".githooks/pre-push")), "the hook that runs the gate");
  for (const absent of [
    ".claude/hooks/guard.mjs",
    "CHANGELOG.md",
    "docs/STANDARDS_PROGRESS.md",
    "AGENTS.md",
  ])
    assert.equal(existsSync(join(dir, absent)), false, absent);
  assert.ok((r.out.match(/ (written|merged) /g) || []).length <= 12, r.out);
  const rules = JSON.parse(cli(["rules", dir, "--json"], dir).out);
  assert.equal(rules.length, 13);
});

test("an agent asked for brings its harness, still without the standard's documents", () => {
  const dir = tempRepo("minimal-agent", { "package.json": PKG });
  assert.equal(cli(["init", dir, "--yes", "--agent", PRIMARY.id], dir).code, 0);
  assert.ok(existsSync(join(dir, ".claude/hooks/guard.mjs")));
  assert.equal(existsSync(join(dir, "docs/STANDARDS_PROGRESS.md")), false);
});

test("the synovitec setup is one flag away, and a repository configured before keeps it", () => {
  const named = tempRepo("minimal-named", { "package.json": PKG });
  assert.equal(cli(["init", named, "--yes", "--profile", "synovitec"], named).code, 0);
  assert.deepEqual(config(named).profiles, ["synovitec"]);
  assert.ok(
    existsSync(join(named, "CHANGELOG.md")) && existsSync(join(named, ".claude/hooks/guard.mjs")),
  );
  // A config with no `profiles` key was measured against synovitec: an upgrade moves nobody.
  const before = tempRepo("minimal-before", { "package.json": PKG });
  writeFileSync(join(before, "abatty.config.json"), JSON.stringify({ stack: "node" }) + "\n");
  assert.equal(cli(["init", before, "--yes"], before).code, 0);
  assert.equal(
    config(before).profiles,
    undefined,
    "nothing written into a config the repository kept",
  );
  assert.ok(existsSync(join(before, ".claude/hooks/guard.mjs")), "the harness, as before");
});

test("minimal sets up no dead-code step and no compiler for plain JavaScript, and update does not add them back", () => {
  // knip's zero-issue default turned an existing codebase's first gate red, and a plain
  // JavaScript package was given TypeScript to install; neither is a minimal rule.
  const dir = tempRepo("minimal-tools", {
    "package.json": PKG,
    "src/a.js": "module.exports = 1;\n",
  });
  const r = cli(["init", dir, "--yes"], dir);
  assert.equal(existsSync(join(dir, "knip.jsonc")), false);
  assert.doesNotMatch(r.out, /\bknip\b[^.]*\binstall|typescript@/);
  assert.match(r.out, /Not in the gate yet/);
  const scripts = () => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts;
  assert.equal(scripts().dead, undefined);
  cli(["update", dir], dir);
  assert.equal(scripts().dead, undefined, "update offers what init would write");
  // the other direction: the synovitec setup keeps both
  const full = tempRepo("minimal-tools-full", { "package.json": PKG });
  cli(["init", full, "--yes", "--profile", "synovitec"], full);
  assert.ok(existsSync(join(full, "knip.jsonc")));
});

test("under minimal a required step with no script is skipped and named; under the standard it stops the gate", () => {
  // A fresh Next.js app ships with no test script: under the standard the gate could not run,
  // which broke the minimal profile's promise of a green first gate. The headline still says it.
  const files = {
    "package.json": JSON.stringify({
      name: "g",
      private: true,
      scripts: { typecheck: "node -e 0", standards: "node -e 0 --" },
      dependencies: { next: "15.0.0" },
    }),
    "package-lock.json": "{}\n",
    "src/a.ts": "export const a = 1;\n",
  };
  const minimal = tempRepo("gate-minimal", {
    ...files,
    "abatty.config.json": JSON.stringify({ profiles: ["minimal"] }),
  });
  const r = cli(["gate", minimal, "--fast", "--stack", "next"], minimal);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /skipped unit tests \(TEST\.1\)/);
  assert.match(r.out, /gate green with \d+ of \d+ step\(s\) not run \([^)]*unit tests/);
  const standard = tempRepo("gate-standard", {
    ...files,
    "abatty.config.json": JSON.stringify({ profiles: ["synovitec"] }),
  });
  const s = cli(["gate", standard, "--fast", "--stack", "next"], standard);
  assert.equal(s.code, 4, s.out);
  assert.match(s.out, /unit tests \(TEST\.1\) could not run: no "test" script/);
});

test("on the minimal profile doctor judges no agent harness it never installed, and status names it as a choice", () => {
  // A design repository's doctor read eighteen harness files as missing and said NOT ok right
  // after init, and its status said "hooks missing · abatty init".
  const dir = tempRepo("minimal-doctor", { "package.json": PKG });
  cli(["init", dir, "--yes"], dir);
  const d = cli(["doctor", dir], dir);
  assert.doesNotMatch(d.out, /missing\s+\.claude\//);
  assert.match(d.out, /0 missing/);
  assert.doesNotMatch(d.out, /^Hooks/m);
  const s = cli(["status", dir, "--fresh"], dir);
  assert.match(s.out, /agent harness\s+none · init --agent <id> adds one/);
  assert.doesNotMatch(s.out, /hooks\s+missing/);
});

test("a docs repository's config names only the commands it has, and init says the git setting it changes", () => {
  // A design repository's config listed `npm test`, a typecheck and eslint, and init set git's
  // core.hooksPath without saying so, though it holds for every branch of the clone.
  const dir = tempRepo("minimal-docs-config", { "docs/a.md": "# a\n" });
  const r = cli(["init", dir, "--yes"], dir);
  assert.deepEqual(Object.keys(config(dir).commands).sort(), ["gate", "gateFull", "standards"]);
  assert.match(r.out, /points git's core\.hooksPath at \.githooks/);
});
