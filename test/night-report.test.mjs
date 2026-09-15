import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { runNight } from "../src/night/runner.mjs";
import { distil, gatherNight, nightDates, renderNightReport } from "../src/night/report.mjs";

/** A repository with the harness committed, a no-op gate and one phase. @param {string} name */
function nightRepo(name) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts["gate:fast"] = 'node -e "process.exit(0)"';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.commands.gate = "npm run gate:fast";
  // Two phases: each session leaves the tree dirty once, and twice is a recurrence.
  cfg.phases = [11, 12];
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  return dir;
}

test("after a stub night: the facts are gathered, the recurring dirty-tree block becomes a proposed lesson, the report renders and writes", () => {
  const dir = nightRepo("nr-happy");
  const r = runNight({
    repoDir: dir,
    until: "+10min",
    maxCostUsd: 10,
    noPush: true,
    agent: STUB_AGENT,
    log: () => {},
  });
  assert.equal(r.ok, true);
  const date = new Date().toISOString().slice(0, 10);
  assert.deepEqual(nightDates(dir), [date]);
  const n = gatherNight(dir);
  assert.ok(n);
  assert.equal(n.date, date);
  assert.equal(n.branch, r.branch);
  assert.ok(n.sessions.length >= 3, "two phases and the wrap-up");
  assert.ok(n.sessions.every((s) => !s.crashed && s.cost > 0));
  assert.ok(n.receipts.length >= 2, "a Stop receipt per session");
  assert.ok(
    n.denials.some((d) => /no-verify/.test(d.what)),
    "the canary's refused commit is in the denial log",
  );
  assert.equal(n.phases[0].status, "done");
  assert.equal(
    n.blocks.filter((b) => b.check === "tree").length,
    2,
    "one block per phase session, kept by the log",
  );
  assert.ok(n.commits.length >= 2);
  const tree = n.lessons.find((l) => l.kind === "stop-gate" && /"tree"/.test(l.title));
  assert.ok(tree, JSON.stringify(n.lessons.map((l) => l.title)));
  assert.match(tree?.lesson || "", /uncommitted work/);
  const md = renderNightReport(n);
  assert.match(md, /^---\ntitle: "Night report/);
  assert.match(md, /## Proposed lessons/);
  assert.match(md, /the Stop gate blocked on "tree"/);
  const out = cli(["night-report", dir, "--out", "docs/NIGHT_REPORT.md"], dir);
  assert.equal(out.code, 0, out.out);
  assert.ok(existsSync(join(dir, "docs/NIGHT_REPORT.md")));
  const json = JSON.parse(cli(["night-report", dir, "--json"], dir).out);
  assert.equal(json.date, date);
  assert.ok(Array.isArray(json.lessons));
});

test("no night, no report: the command says so and names the folders it knows", () => {
  const dir = tempRepo("nr-none", { "package.json": NEXT_PKG });
  const r = cli(["night-report", dir], dir);
  assert.equal(r.code, 2);
  assert.match(r.out, /no night to report on/);
  assert.equal(gatherNight(dir), null);
});

test("the heuristics, on synthetic evidence: a refused command shape, a denial storm, a crash, a blocked phase, a recurring decision, a direction finding, a failed canary", () => {
  const dir = tempRepo("nr-synthetic", {
    "package.json": NEXT_PKG,
    "docs/ADOPTION_DECISIONS.md":
      "# Decisions\n\n- **2026-09-15** phase 1 · decision: seam-unclear · x\n- **2026-09-15** phase 1 · decision: seam-unclear · y\n- **2026-09-15** phase 1 · decision: harness-change · z\n",
  });
  const date = "2026-09-15";
  const night = join(dir, ".claude", "night");
  mkdirSync(join(night, date), { recursive: true });
  writeFileSync(
    join(night, "run.json"),
    JSON.stringify({
      startedAt: `${date}T22:00:00Z`,
      branch: "adopt/standards-2026-09-15",
      base: "main",
      until: "07:00",
      maxCostUsd: 10,
    }),
  );
  writeFileSync(
    join(night, date, "phase-1-220100.json"),
    JSON.stringify({
      total_cost_usd: 1,
      permission_denials: Array.from({ length: 20 }, () => ({})),
      session_id: "s1",
      is_error: false,
    }),
  );
  writeFileSync(join(night, date, "phase-1-220500.json"), "not json at all");
  writeFileSync(join(night, date, "canary.json"), JSON.stringify({ is_error: true, result: "x" }));
  writeFileSync(
    join(night, date, "direction.txt"),
    "[direction] 1 loosening(s) against main\n- baseline · metrics.x rose 1 → 2\n",
  );
  writeFileSync(
    join(night, "guard-denials.jsonl"),
    [
      JSON.stringify({
        at: `${date}T22:01:00.000Z`,
        tool: "Bash",
        command: "git push --force origin main",
        reason: "force",
      }),
      JSON.stringify({
        at: `${date}T22:02:00.000Z`,
        tool: "Bash",
        command: "git push --force origin feat",
        reason: "force",
      }),
      JSON.stringify({
        at: `2026-09-14T22:02:00.000Z`,
        tool: "Bash",
        command: "rm -rf x",
        reason: "old night",
      }),
    ].join("\n") + "\n",
  );
  writeFileSync(
    join(night, "stop-gate-s1.json"),
    JSON.stringify({
      at: `${date}T22:03:00.000Z`,
      sessionId: "s1",
      phase: "1",
      decision: "block",
      reason: "The gate is red",
      blockNumber: 3,
      checks: [
        { check: "branch", ok: true },
        { check: "gate", ok: false },
      ],
    }),
  );
  writeFileSync(
    join(night, "stop-blocks.jsonl"),
    [1, 2, 3]
      .map((n) =>
        JSON.stringify({
          at: `${date}T22:0${n}:30.000Z`,
          sessionId: "s1",
          phase: "1",
          check: "gate",
          reason: "The gate is red",
          block: n,
        }),
      )
      .join("\n") + "\n",
  );
  writeFileSync(
    join(dir, "docs/ADOPTION_STATE.json"),
    JSON.stringify({
      startedAt: `${date}T22:00:00Z`,
      phases: [
        { id: 1, status: "blocked", reason: "still in_progress after 2 sessions (1 no-op)" },
      ],
    }),
  );
  const n = gatherNight(dir, date);
  assert.ok(n);
  assert.equal(n.denials.length, 2, "only this night's denials");
  assert.equal(n.sessions.length, 2);
  assert.equal(n.sessions[1]?.crashed, true);
  const kinds = n.lessons.map((l) => l.kind).sort();
  assert.deepEqual(
    [...new Set(kinds)],
    ["canary", "decision", "direction", "guard", "phase", "session", "stop-gate"],
  );
  assert.match(n.lessons.find((l) => l.kind === "guard")?.title || "", /git push --force" 2 times/);
  assert.match(
    n.lessons.find((l) => l.kind === "phase")?.lesson || "",
    /no commit and no decision/,
  );
  assert.match(
    n.lessons.find((l) => l.kind === "decision")?.title || "",
    /seam-unclear recorded 2 times/,
  );
  assert.match(n.lessons.find((l) => l.kind === "stop-gate")?.title || "", /"gate" 3 time/);
  assert.equal(n.lessons.filter((l) => l.kind === "session").length, 2, "a storm and a crash");
  assert.equal(
    distil({
      ...n,
      receipts: [],
      blocks: [],
      denials: [],
      sessions: [],
      phases: [],
      decisions: {},
      direction: [],
      canary: { ok: true, findings: [] },
    }).length,
    0,
    "a quiet night proposes nothing",
  );
  assert.match(renderNightReport(n), /### the guard refused "git push --force" 2 times/);
});
