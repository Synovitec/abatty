import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import { analyze } from "../src/core/gap-analysis.mjs";
import { normalise } from "../src/core/doctor.mjs";

test("doctor after init: the repository's self-test runs and every shipped file is in step", () => {
  const dir = tempRepo("doctor", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  const r = cli(["doctor", dir], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /harness ok/);
  assert.match(r.out, /drift: 0 file\(s\) differ/);
  assert.match(r.out, /doctor: ok/);
});

test("the harness self-test holds for a repository that opted into the scrub", () => {
  const dir = tempRepo("doctor-scrub", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const cfg = join(dir, "abatty.config.json");
  const config = JSON.parse(readFileSync(cfg, "utf8"));
  writeFileSync(cfg, JSON.stringify({ ...config, scrub: { enabled: true } }, null, 2) + "\n");
  // The scrub's own case is proven elsewhere; what this holds is that the case for the DEFAULT
  // reads a default config and not the repository's. Pointing it at the repository's own config
  // was the bug: a repository that opted in then failed its harness on the default's case, and
  // the night it refused was the night it was installed for.
  const home = mkdtempSync(join(tmpdir(), "abatty-home-"));
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(
    join(home, ".claude/settings.json"),
    JSON.stringify({ attribution: { commit: "" } }),
  );
  const r = cli(["doctor", dir], dir, { HOME: home, USERPROFILE: home });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /harness ok/);
});

test("doctor names a hook edited beyond formatting, and a missing one", () => {
  const dir = tempRepo("doctor2", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const guard = join(dir, ".claude/hooks/guard.mjs");
  writeFileSync(
    guard,
    readFileSync(guard, "utf8").replace("Force push is never allowed", "Force push is fine"),
  );
  const r = cli(["doctor", dir, "--skip-self-test", "--strict"], dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /differs\s+\.claude\/hooks\/guard\.mjs/);
});

test("normalise is blind to Prettier's formatting", () => {
  const a = `module.exports = {\n  forbidden: [\n    { name: "x", from: {}, to: { circular: true } },\n  ],\n};\n`;
  const b = `module.exports = { forbidden: [{ name: 'x', from: {}, to: { circular: true } }] };`;
  assert.equal(normalise(a), normalise(b));
});

test("measure writes the dated report with the standard's front matter and a score", () => {
  const dir = tempRepo("measure", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const r = cli(["measure", dir, "--quiet"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Score \d+\/100 over \d+ applicable checks/);
  const report = readFileSync(
    join(dir, "docs", `GAP_ANALYSIS_${new Date().toISOString().slice(0, 10)}.md`),
    "utf8",
  );
  assert.match(report, /^---\ntitle: "Gap analysis/);
  assert.match(report, /\| INST-GATE \|/);
  assert.doesNotMatch(
    report,
    /\bCODE-\d{1,2}\b/,
    "the standard's rule IDs are spaced so a repository's own citation checker does not claim them",
  );
});

test("measure --json on a bare directory scores 0 and names what is missing; after init the harness rows are present", () => {
  const bare = tempRepo("measure-bare", { "package.json": NEXT_PKG });
  const before = analyze(bare);
  const harnessBefore = before.findings.filter(
    (f) => f.family === "Harness" && f.status === "present",
  ).length;
  cli(["init", bare, "--stack", "next"], bare);
  const after = analyze(bare);
  const harnessAfter = after.findings.filter(
    (f) => f.family === "Harness" && f.status === "present",
  ).length;
  assert.ok(
    harnessAfter > harnessBefore,
    `harness rows present: ${harnessBefore} -> ${harnessAfter}`,
  );
  assert.ok(after.score > before.score, `score ${before.score} -> ${after.score}`);
});

test("the gate runs the always-on steps in order, skips what has no script, stops at the first failure", () => {
  const dir = tempRepo("gate", {
    "package.json": JSON.stringify({
      name: "g",
      scripts: {
        "format:check": "true",
        lint: "true",
        typecheck: "true",
        test: "true",
        standards: "true",
      },
    }),
    ".dependency-cruiser.cjs": "module.exports = {};\n",
  });
  const preset = presetById("next");
  assert.ok(preset);
  /** @type {string[]} */
  const calls = [];
  /** @type {string[]} */
  const lines = [];
  const r = runGate({
    repoDir: dir,
    preset,
    fast: true,
    run: (_d, script) => {
      calls.push(script);
      return script === "test" ? 1 : 0;
    },
    log: (l) => lines.push(l),
  });
  assert.equal(r.ok, false);
  assert.deepEqual(
    calls,
    ["lint", "typecheck", "test"],
    "graph has a config but no script, so it is skipped; dead has neither; test fails and ends the gate",
  );
  assert.ok(lines.some((l) => /skipped import graph.*no "graph" script/.test(l)));
  assert.ok(lines.some((l) => /skipped dead code.*no knip/.test(l)));
  assert.ok(lines.some((l) => /✗ unit tests/.test(l)));
});

test("the gate's suites are path-aware and defer without Docker", () => {
  const dir = tempRepo("gate2", {
    "package.json": JSON.stringify({
      name: "g",
      scripts: { test: "true", "test:rls": "true", coverage: "true", build: "true", e2e: "true" },
    }),
  });
  mkdirSync(join(dir, "src", "db"), { recursive: true });
  writeFileSync(join(dir, "src", "db", "schema.ts"), "export const t = 1;\n");
  const preset = presetById("next");
  assert.ok(preset);
  /** @type {string[]} */
  const calls = [];
  const noDocker = runGate({
    repoDir: dir,
    preset,
    run: (_d, s) => {
      calls.push(s);
      return 0;
    },
    dockerUp: () => false,
    log: () => {},
  });
  assert.equal(noDocker.ok, true);
  assert.ok(
    noDocker.events.some((e) => e.outcome === "deferred" && /database suite/.test(e.label)),
    JSON.stringify(noDocker.events),
  );
  const withDocker = runGate({
    repoDir: dir,
    preset,
    run: (_d, s) => {
      calls.push(s);
      return 0;
    },
    dockerUp: () => true,
    log: () => {},
  });
  assert.equal(withDocker.ok, true);
  assert.ok(calls.includes("test:rls"), "the alternative script name is found");
  assert.ok(calls.includes("coverage"));
  assert.ok(!calls.includes("e2e"), "no UI path touched, the browser suite is skipped");
});
