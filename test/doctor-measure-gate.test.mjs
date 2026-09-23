import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { pushRangeInfo } from "../src/core/range.mjs";
import { presetById } from "../src/presets/index.mjs";
import { analyze } from "../src/core/gap-analysis.mjs";
import { normalise } from "../src/core/doctor.mjs";
import { sampleTrailer } from "../src/core/vocabulary.mjs";
import { localToday } from "../src/core/today.mjs";

test("doctor after init: the repository's self-test runs and every shipped file is in step", () => {
  const dir = tempRepo("doctor", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  // As hooks:install does on every clone: on a machine without file modes the commit above
  // recorded the hooks 100644, and this stages the bit git needs to run them anywhere else.
  cli(["hooks", dir], dir);
  git(dir, "commit", "-q", "--allow-empty", "-m", "chore: the hooks executable");
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
  assert.equal(r.code, 3);
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
  const report = readFileSync(join(dir, "docs", `GAP_ANALYSIS_${localToday()}.md`), "utf8");
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

test("a step whose tool could not run is errored, not failed: the instrument, not the work", () => {
  // A dead-code analyser that crashes and one that found dead code must not read the same. The
  // gate stops for both, because an unproven step is not a passed step, but only one of them is
  // a verdict on the work, and the exit code a pipeline branches on is different.
  const dir = tempRepo("gate-errored", {
    "package.json": JSON.stringify({
      name: "app",
      private: true,
      scripts: { lint: "true", typecheck: "true", test: "true" },
    }),
  });
  const preset = presetById("next");
  assert.ok(preset);
  /** @type {string[]} */
  const lines = [];
  const crashed = runGate({
    repoDir: dir,
    preset,
    fast: true,
    run: (_d, script) =>
      script === "typecheck"
        ? { code: 127, errored: true, detail: "command not found" }
        : { code: 0 },
    log: (l) => lines.push(l),
  });
  assert.equal(crashed.ok, false);
  assert.equal(crashed.errored, true);
  const step = crashed.events.find((e) => e.outcome === "errored");
  assert.ok(step, JSON.stringify(crashed.events));
  assert.equal(step.detail, "command not found");
  assert.ok(
    lines.some((l) => /could not run.*command not found.*instrument, not the work/.test(l)),
    lines.join("\n"),
  );
  assert.ok(
    !crashed.events.some((e) => e.outcome === "failed"),
    "a step that could not run is not a step that failed",
  );

  // The control in the other direction: the same step exiting non-zero after it ran is a failure,
  // and the gate does not report the instrument.
  const failed = runGate({
    repoDir: dir,
    preset,
    fast: true,
    run: (_d, script) => (script === "typecheck" ? 1 : 0),
    log: () => {},
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.errored, false);
  assert.ok(failed.events.some((e) => e.outcome === "failed"));
});

test("the gate's suites are path-aware and defer without Docker", () => {
  const dir = tempRepo("gate2", {
    "package.json": JSON.stringify({
      name: "g",
      scripts: {
        test: "true",
        typecheck: "true",
        standards: "true",
        "test:rls": "true",
        coverage: "true",
        build: "true",
        e2e: "true",
      },
    }),
    "package-lock.json": "{}\n",
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
    audit: () => ({ status: 0, output: "" }),
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

test("the gate holds the scrub for a repository that opted in, and skips it for one that did not", () => {
  // Non-negotiable for a repository that scrubs, and the last point a file can still be changed
  // without rewriting history. Both directions, because a step that never goes red is absent.
  const scripts = { "format:check": "true", typecheck: "true", test: "true", standards: "true" };
  const preset = presetById("node");
  assert.ok(preset);
  const run = (/** @type {string} */ dir) => {
    /** @type {string[]} */
    const lines = [];
    const r = runGate({
      repoDir: dir,
      preset,
      fast: true,
      run: () => 0,
      audit: () => ({ status: 0, output: "" }),
      log: (l) => lines.push(l),
    });
    return { r, out: lines.join("\n") };
  };

  // Opted out: the step is skipped and says why, whatever the files hold.
  const off = tempRepo("gate-scrub-off", {
    "package.json": JSON.stringify({ name: "g", scripts }),
    "package-lock.json": "{}\n",
    "abatty.config.json": JSON.stringify({ scrub: { enabled: false } }),
    "docs/NOTE.md": `a line naming ${sampleTrailer()}\n`,
  });
  const offRun = run(off);
  assert.equal(offRun.r.ok, true, offRun.out);
  assert.ok(
    offRun.r.events.some((e) => /scrub/.test(e.label) && e.outcome === "skipped"),
    "skipped where the repository did not opt in",
  );

  // Opted in with a trace in a file: red, and the file and line are named.
  const on = tempRepo("gate-scrub-on", {
    "package.json": JSON.stringify({ name: "g", scripts }),
    "package-lock.json": "{}\n",
    "abatty.config.json": JSON.stringify({ scrub: { enabled: true } }),
    "docs/NOTE.md": `a line naming ${sampleTrailer()}\n`,
  });
  const onRun = run(on);
  assert.equal(onRun.r.ok, false, "the gate refuses the trace");
  assert.ok(onRun.r.events.some((e) => /scrub/.test(e.label) && e.outcome === "failed"));
  assert.match(onRun.out, /docs\/NOTE\.md:1/);

  // Opted in and clean: green, so the step is not merely always red.
  const clean = tempRepo("gate-scrub-clean", {
    "package.json": JSON.stringify({ name: "g", scripts }),
    "package-lock.json": "{}\n",
    "abatty.config.json": JSON.stringify({ scrub: { enabled: true } }),
    "docs/NOTE.md": "a line naming nothing at all\n",
  });
  const cleanRun = run(clean);
  assert.equal(cleanRun.r.ok, true, cleanRun.out);
  assert.ok(cleanRun.r.events.some((e) => /scrub/.test(e.label) && e.outcome === "ok"));
});

test("a repository with no lockfile has no audit: the step could not run, and the gate stops there", () => {
  // The audit step answered "skipped" without a lockfile, and a skipped step is a passed step at
  // the gate: a pnpm product with seventy advisories had a green gate for as long as it ran one.
  // Both directions: the same fixture with a lockfile runs the audit and passes.
  const scripts = { "format:check": "true", typecheck: "true", test: "true", standards: "true" };
  const preset = presetById("node");
  assert.ok(preset);
  const run = (/** @type {string} */ dir) => {
    /** @type {string[]} */
    const lines = [];
    const r = runGate({
      repoDir: dir,
      preset,
      fast: true,
      run: () => 0,
      audit: () => ({ status: 0, output: "" }),
      log: (l) => lines.push(l),
    });
    return { r, out: lines.join("\n") };
  };
  const bare = run(
    tempRepo("gate-nolock", { "package.json": JSON.stringify({ name: "g", scripts }) }),
  );
  assert.equal(bare.r.ok, false, bare.out);
  assert.equal(bare.r.errored, true, "the instrument, not the work");
  assert.ok(
    bare.r.events.some((e) => /audit/.test(e.label) && e.outcome === "errored"),
    JSON.stringify(bare.r.events),
  );
  assert.match(bare.out, /audit \(SEC\.1\) could not run: no lockfile/);

  const locked = run(
    tempRepo("gate-lock", {
      "package.json": JSON.stringify({ name: "g", scripts }),
      "package-lock.json": "{}\n",
    }),
  );
  assert.equal(locked.r.ok, true, locked.out);
  assert.ok(locked.r.events.some((e) => /audit/.test(e.label) && e.outcome === "ok"));
});

test("the push range says how it was found: an upstream, a fork point, or nothing to compare with", () => {
  const dir = tempRepo("range-how", { "package.json": NEXT_PKG });
  // On main with no origin: the fork point of main and HEAD is HEAD itself, found and empty.
  assert.deepEqual(pushRangeInfo(dir, "main"), {
    range: `${git(dir, "rev-parse", "HEAD")}..HEAD`,
    how: "fork",
    commits: 0,
  });
  // A branch off main with a commit: the fork point, one commit in it.
  git(dir, "checkout", "-q", "-b", "feat/x");
  writeFileSync(join(dir, "a.txt"), "a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a");
  assert.equal(pushRangeInfo(dir, "main").how, "fork");
  assert.equal(pushRangeInfo(dir, "main").commits, 1);
  // Told the base is a branch that does not exist: nothing to compare with, and it says so.
  const blind = pushRangeInfo(dir, "trunk");
  assert.equal(blind.how, "unknown");
  assert.equal(blind.range, "HEAD~1..HEAD");
  // Told explicitly: taken as given, counted.
  assert.deepEqual(pushRangeInfo(dir, "main", "main..HEAD"), {
    range: "main..HEAD",
    how: "explicit",
    commits: 1,
  });
});

test("a range the gate cannot trust selects everything, never nothing: in CI an empty range is the event, not an empty push", () => {
  // A gate run in CI without --range, on a checkout whose upstream the push itself just moved,
  // read "0 pushed files", skipped the build, browser and database suites and printed green.
  // Both directions: the same tree, the same empty range, judged locally and in CI.
  const scripts = {
    test: "true",
    typecheck: "true",
    standards: "true",
    build: "true",
    e2e: "true",
    "test:rls": "true",
    coverage: "true",
  };
  const dir = tempRepo("range-ci", {
    "package.json": JSON.stringify({ name: "g", scripts }),
    "package-lock.json": "{}\n",
    "src/app/page.tsx": "export default function Page() { return null; }\n",
  });
  const preset = presetById("next");
  assert.ok(preset);
  const gate = (/** @type {boolean} */ ci) => {
    /** @type {string[]} */
    const calls = [];
    /** @type {string[]} */
    const lines = [];
    const r = runGate({
      repoDir: dir,
      preset,
      ci,
      run: (_d, s) => {
        calls.push(s);
        return 0;
      },
      audit: () => ({ status: 0, output: "" }),
      dockerUp: () => true,
      log: (l) => lines.push(l),
    });
    return { r, calls, out: lines.join("\n") };
  };
  const local = gate(false);
  assert.equal(local.r.ok, true, local.out);
  assert.equal(
    local.r.blind,
    false,
    "locally, at the upstream with a clean tree, there is nothing to push",
  );
  assert.ok(
    !local.calls.includes("e2e"),
    "no path in the push or the tree: the browser suite is skipped",
  );

  const ci = gate(true);
  assert.equal(ci.r.ok, true, ci.out);
  assert.equal(ci.r.blind, true);
  assert.match(ci.out, /could not be trusted \(in CI the push is the event/);
  assert.match(ci.out, /every path is selected/);
  assert.ok(ci.calls.includes("e2e"), "every path selected: the browser suite runs");

  // And a range nobody can compute at all (no upstream, no base) is blind wherever it runs.
  git(dir, "checkout", "-q", "-b", "work");
  git(dir, "branch", "-q", "-D", "main");
  const orphan = gate(false);
  assert.equal(orphan.r.blind, true);
  assert.match(orphan.out, /no upstream and no main to fork from/);
  assert.ok(orphan.calls.includes("e2e"));
});

test("a step the preset requires cannot be skipped for want of a script: the gate could not run, and a green with steps not run says how many", () => {
  // The reviewer's repro, the other half of the false green: a repository with a lockfile and no
  // scripts read "gate green · 2 step(s)" with seven steps skipped and exit 0. `errored` covered
  // the instrument breaking; it did not cover the instrument never being installed.
  const scriptless = tempRepo("gate-scriptless", {
    "package.json": JSON.stringify({
      name: "g",
      version: "0.1.0",
      private: true,
      dependencies: { next: "15.0.0" },
    }),
    "package-lock.json": "{}\n",
    "src/a.ts": "export const a = 1;\n",
  });
  const bare = cli(["gate", scriptless, "--fast", "--stack", "next"], scriptless);
  assert.equal(bare.code, 4, bare.out);
  assert.match(
    bare.out,
    /typecheck \(CODE\.3\) could not run: no "typecheck" script, and the next preset requires this step/,
  );
  assert.match(bare.out, /gate could not run/);
  assert.ok(!/gate green/.test(bare.out));

  // The required steps present, the optional ones still absent: green, and the headline says
  // what did not run before it says the colour.
  const partial = tempRepo("gate-partial", {
    "package.json": JSON.stringify({
      name: "g",
      version: "0.1.0",
      private: true,
      scripts: { typecheck: "node -e 0", test: "node -e 0", standards: "node -e 0 --" },
      dependencies: { next: "15.0.0" },
    }),
    "package-lock.json": "{}\n",
    "src/a.ts": "export const a = 1;\n",
  });
  const some = cli(["gate", partial, "--fast", "--stack", "next"], partial);
  assert.equal(some.code, 0, some.out);
  assert.match(
    some.out,
    /gate green with 5 of 10 step\(s\) not run \(format, lint, import graph, dead code, coverage of the changed lines: no script or config\)/,
  );

  // Every step present: the plain verdict, so the warning above is not noise on a full gate.
  const full = tempRepo("gate-full", {
    "package.json":
      JSON.stringify(
        {
          name: "g",
          version: "0.1.0",
          private: true,
          scripts: {
            lint: "node -e 0",
            typecheck: "node -e 0",
            graph: "node -e 0",
            dead: "node -e 0",
            test: "node -e 0",
            "coverage:changed": "node -e 0",
            standards: "node -e 0 --",
          },
          dependencies: { next: "15.0.0" },
        },
        null,
        2,
      ) + "\n",
    "package-lock.json": "{}\n",
    ".prettierrc": "{}\n",
    ".dependency-cruiser.cjs": "module.exports = {};\n",
    "knip.jsonc": "{}\n",
    "src/a.ts": "export const a = 1;\n",
  });
  const all = cli(["gate", full, "--fast", "--stack", "next"], full);
  assert.equal(all.code, 0, all.out);
  assert.match(all.out, /gate green ·/);
  assert.ok(!/not run/.test(all.out));
});

test("end to end, through real npm: a tool that ran and failed exits 3, one that could not run exits 4", () => {
  // The test above proves runGate classifies an injected result. This one drives the real spawn
  // path, because that is where the distinction was actually untested: the suite passed on a
  // machine with a linter installed and went red on a runner without one, and the assertions
  // were then widened to accept either answer, which is the one thing they must not do. The
  // fixtures below control the outcome instead of hoping for it. `node` always exists; the other
  // name cannot.
  /** @param {string} name @param {string} lint */
  const gateOf = (name, lint) => {
    const dir = tempRepo(name, {
      "package.json":
        JSON.stringify({
          name: "fixture",
          version: "0.1.0",
          private: true,
          scripts: { lint },
          dependencies: { express: "5.0.0" },
        }) + "\n",
      "src/a.mjs": "export const a = 1;\n",
    });
    return cli(["gate", dir, "--fast"], dir);
  };

  const ran = gateOf("gate-exit-3", 'node -e "process.exit(1)"');
  assert.equal(ran.code, 3, ran.out);
  assert.match(ran.out, /✗ lint \(CODE\.4\)/);
  assert.equal(
    /could not run/.test(ran.out),
    false,
    "the tool ran: this is the work, not the instrument",
  );

  // cmd.exe exits 1 for a tool it cannot find, the code a tool that ran and failed returns; the
  // gate looks the script's program up after a 1 on Windows, so the answer is the same everywhere.
  const absent = gateOf("gate-exit-4", "abatty-no-such-binary-__ .");
  assert.equal(absent.code, 4, absent.out);
  assert.match(absent.out, /lint \(CODE\.4\) could not run/);
  assert.match(absent.out, /the instrument, not the work/);
});
