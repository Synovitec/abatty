/**
 * The night runner: one headless session per phase on a dedicated branch until the hour or
 * the budget runs out, with the pre-flight that refuses a night the morning could not trust.
 * One implementation for Windows and POSIX, replacing the two shell runners of the first
 * week, whose every bug (a BOM, a locale's decimal comma, a shell's path conversion, a crash
 * counted as a session) was runner-side.
 *
 * Before the first phase, four things or no night: the harness self-test green, `.claude/`
 * identical to the base branch, the gate green on the branch as it starts, and the canary.
 * Then the loop: the next pending phase, at most `maxSessionsPerPhase` sessions each, a crash
 * retried once and a second crash in a row an abort, fifteen denials an abort (auto mode did
 * not take), the harness checked before every session, the wrap-up, and a push only when the
 * harness is untouched and nothing was loosened against the base without a decision naming it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { git } from "../core/repo.mjs";
import { runCanary } from "./canary.mjs";
import { preflight, readJson, writeJson } from "./preflight.mjs";
import { deadlineOf, runSession } from "./session.mjs";

/**
 * @typedef {{
 *   repoDir: string,
 *   until?: string,
 *   maxCostUsd?: number,
 *   phases?: string[],
 *   model?: string,
 *   effort?: string,
 *   mode?: "auto" | "dontAsk",
 *   noPush?: boolean,
 *   skipCanary?: boolean,
 *   canaryOnly?: boolean,
 *   agent?: string,
 *   log?: (line: string) => void,
 * }} NightOptions
 * @typedef {{ ok: boolean, code: number, abort: string, spent: number, branch: string, pushed: boolean, canaryOnly?: boolean }} NightResult
 */

/**
 * Run a night. Never throws for a refused night: the result carries the reason and the exit
 * code the shell runners used (1 refused, 2 aborted, 3 auto mode unavailable).
 * @param {NightOptions} o
 * @returns {NightResult}
 */
export function runNight(o) {
  const repoDir = resolve(o.repoDir);
  const log = o.log || ((l) => process.stderr.write(l + "\n"));
  const until = o.until || "07:00";
  const maxCost = o.maxCostUsd ?? 60;
  const mode = o.mode || "auto";
  /** @param {string} why @param {number} [code] */
  const refuse = (why, code = 1) => {
    log(why);
    return { ok: false, code, abort: why, spent: 0, branch: "", pushed: false };
  };
  const pf = preflight(o, { repoDir, log, until, maxCost, refuse });
  if ("code" in pf) return pf;
  const {
    agent,
    base,
    stateFile,
    decisionsFile,
    maxSessions,
    phases,
    date,
    branch,
    nightDir,
    startedAt,
    mcpConfig,
    mcpServers,
    harnessMoved,
    adapter,
  } = pf;
  const session = {
    adapter,
    agent,
    mode,
    model: o.model || "opus",
    effort: o.effort || "high",
    mcpConfig,
    log,
  };
  let spent = 0;
  if (!o.skipCanary) {
    const c = runCanary(
      { repoDir, branch, base, until, date, nightDir, mcpServers, mcpConfig },
      session,
    );
    spent += c.cost;
    if (c.failed.length) {
      log(
        `canary failed - the night would not have been what it claims. ${c.failed.length} finding(s):`,
      );
      for (const f of c.failed) log(`- ${f}`);
      log(`read ${c.json} and ${c.stderr}`);
      return { ok: false, code: 1, abort: "canary failed", spent, branch, pushed: false };
    }
    log(
      `  canary ok: a command ran without a prompt, the guard refused --no-verify, the Stop hook allowed the stop reading adoption.json from ${base}, MCP servers declared: ${mcpServers.join(" ") || "none"} (${c.cost.toFixed(2)} USD)`,
    );
  }
  if (o.canaryOnly) {
    try {
      writeFileSync(join(repoDir, ".claude/night/run.json"), "");
    } catch {
      /* nothing to remove */
    }
    log(
      `pre-flight done on ${branch}: self-test green, harness identical to ${base}, gate green, canary green. ${spent.toFixed(2)} USD.`,
    );
    return { ok: true, code: 0, abort: "", spent, branch, pushed: false, canaryOnly: true };
  }

  const statePath = join(repoDir, stateFile);
  if (!existsSync(statePath)) {
    writeJson(statePath, {
      startedAt,
      baseBranch: base,
      phases: phases.map((id) => ({ id: /^\d+$/.test(id) ? Number(id) : id, status: "pending" })),
    });
    const back = readJson(statePath);
    if (!Array.isArray(back.phases) || !back.phases.length || !back.startedAt)
      return refuse("state file: phases must be a non-empty array with startedAt");
    git(repoDir, "add", stateFile);
    git(repoDir, "commit", "-q", "-m", `chore(standards): open the adoption state for ${date}`);
  }
  /** @param {string} id */
  const statusOf = (id) => {
    const p = (readJson(statePath).phases || []).find(
      (/** @type {any} */ x) => String(x.id) === id,
    );
    return p ? String(p.status) : "missing";
  };
  /** @param {string} id @param {string} why */
  const blockPhase = (id, why) => {
    const s = readJson(statePath);
    for (const p of s.phases || [])
      if (String(p.id) === id)
        Object.assign(p, { status: "blocked", reason: why, updatedAt: new Date().toISOString() });
    writeJson(statePath, s);
    git(repoDir, "add", stateFile);
    git(
      repoDir,
      "commit",
      "-q",
      "-m",
      `chore(standards): phase ${id} blocked by the runner - ${why}`,
    );
  };
  const decisionsMark = () =>
    existsSync(join(repoDir, decisionsFile)) ? git(repoDir, "hash-object", decisionsFile) : "none";
  /** A phase session: its cost, or "CRASH", or "NOOP" with the cost. @param {string} phase @param {number} budget */
  const runPhase = (phase, budget) => {
    const prompt =
      phase === "wrap-up" ? "/adopt-standards --wrap-up" : `/adopt-standards --phase ${phase}`;
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
    const headBefore = git(repoDir, "rev-parse", "HEAD");
    const markBefore = decisionsMark();
    const r = runSession(
      {
        repoDir,
        prompt,
        budget,
        name: `adopt-${phase}-${date}`,
        outBase: join(nightDir, `phase-${phase}-${stamp}`),
        env: {
          ADOPTION_RUN: "1",
          ADOPTION_BRANCH: branch,
          ADOPTION_BASE: base,
          ADOPTION_UNTIL: until,
          ADOPTION_PHASE: phase,
        },
      },
      session,
    );
    if (r.crashed) return { kind: "crash", cost: 0 };
    if (r.denials >= 15) return { kind: "denials", cost: r.cost, denials: r.denials };
    const noop = git(repoDir, "rev-parse", "HEAD") === headBefore && decisionsMark() === markBefore;
    if (noop) log("  no-op session: no commit and no decision recorded");
    return { kind: noop ? "noop" : "ok", cost: r.cost };
  };

  const deadline = deadlineOf(until);
  let crashes = 0;
  let abort = "";
  let code = 2;
  /** @type {Record<string, { sessions: number, noops: number }>} */
  const counters = {};
  while (Date.now() < deadline && spent < maxCost) {
    const next = phases.find((id) => ["pending", "in_progress"].includes(statusOf(id)));
    if (!next) {
      log("no phase left to run");
      break;
    }
    const c = (counters[next] ||= { sessions: 0, noops: 0 });
    if (c.sessions >= maxSessions) {
      blockPhase(
        next,
        `still ${statusOf(next)} after ${maxSessions} sessions${c.noops ? ` (${c.noops} no-op)` : ""}`,
      );
      continue;
    }
    if (harnessMoved(`before phase ${next}`)) {
      abort = `harness moved before phase ${next}`;
      break;
    }
    const budget = Math.max(5, maxCost - spent);
    const r = runPhase(next, budget);
    if (r.kind === "crash") {
      crashes++;
      if (crashes >= 2) {
        abort =
          "agent failed to run twice in a row (exit without a result); fix the environment, then rerun";
        break;
      }
      continue;
    }
    if (r.kind === "denials") {
      abort = `phase ${next}: ${r.denials} permission denials - auto mode is probably unavailable to headless sessions here; rerun with mode dontAsk and explicit allow rules`;
      code = 3;
      break;
    }
    crashes = 0;
    c.sessions++;
    if (r.kind === "noop") c.noops++;
    spent += r.cost;
    log(`  spent so far: ${spent.toFixed(2)} USD`);
  }

  if (!abort && spent < maxCost) {
    if (harnessMoved("before the wrap-up")) abort = "harness moved before the wrap-up";
    else {
      const r = runPhase("wrap-up", Math.max(5, maxCost - spent));
      spent += r.cost;
    }
  }

  let pushed = false;
  if (!o.noPush && !abort) {
    const d = spawnSync(process.execPath, [".claude/hooks/check-direction.mjs", "--base", base], {
      cwd: repoDir,
      encoding: "utf8",
    });
    writeFileSync(join(nightDir, "direction.txt"), (d.stdout || "") + (d.stderr || ""));
    for (const l of ((d.stdout || "") + (d.stderr || "")).split(/\r?\n/).filter(Boolean))
      log(`  ${l}`);
    if (git(repoDir, "diff", "--name-only", base, "--", ".claude/"))
      log(`branch kept local: the harness (.claude/) differs from ${base}`);
    else if (d.status === 2)
      log(
        `branch kept local: something was loosened against ${base} without a decision naming it (above)`,
      );
    else {
      const p = spawnSync("git", ["push", "-u", "origin", branch], {
        cwd: repoDir,
        encoding: "utf8",
      });
      pushed = p.status === 0;
      if (!pushed) log(`push failed: ${(p.stderr || "").trim()}`);
    }
  }
  log(
    abort
      ? `night-run ABORTED: ${spent.toFixed(2)} USD on ${branch} (not pushed) - ${abort}`
      : `night-run done: ${spent.toFixed(2)} USD on ${branch}${pushed ? " (pushed)" : ""}`,
  );
  log(`read: docs/ADOPTION_REPORT_${date}.md, ${decisionsFile}, ${stateFile}, ${nightDir}/`);
  log(git(repoDir, "log", "--oneline", `${base}..${branch}`));
  return { ok: !abort, code: abort ? code : 0, abort, spent, branch, pushed };
}
