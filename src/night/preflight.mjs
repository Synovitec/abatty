/**
 * The pre-flight of a night, in the order the shell runners proved: the agent's executable, a
 * clean tree, the branch from the local base (it carries a harness committed but not pushed
 * yet), the harness files on it, the self-test there, `.claude/` identical to the base, the
 * night folder and its run file, the MCP servers a session may have at all, and the gate green
 * on the branch as it starts. Any one red is no night.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { git, parseJson, readAdoption } from "../core/repo.mjs";
import { agentCommand, clock } from "./session.mjs";

export const HARNESS_FILES = [
  ".claude/settings.json",
  ".claude/hooks/stop-gate.mjs",
  ".claude/hooks/guard.mjs",
  ".claude/hooks/protect.mjs",
  ".claude/hooks/check-direction.mjs",
  ".claude/skills/adopt-standards/SKILL.md",
];

/** @param {string} p @param {unknown} v JSON without a BOM, LF, a trailing newline: the way the hooks read it back. */
export function writeJson(p, v) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}
/** @param {string} p @returns {any} */
export function readJson(p) {
  return parseJson(readFileSync(p, "utf8"));
}

/**
 * @typedef {import("./runner.mjs").NightOptions} NightOptions
 * @typedef {import("./runner.mjs").NightResult} NightResult
 * @typedef {{
 *   agent: string, config: any, base: string, stateFile: string, decisionsFile: string,
 *   maxSessions: number, phases: string[], date: string, branch: string, nightDir: string,
 *   startedAt: string, mcpConfig: string, mcpServers: string[],
 *   harnessMoved: (when: string) => string,
 * }} Preflight
 */

/**
 * Run the pre-flight. Returns the night's facts, or the refusal as a NightResult.
 * @param {NightOptions} o
 * @param {{ repoDir: string, log: (l: string) => void, until: string, maxCost: number, refuse: (why: string, code?: number) => NightResult }} c
 * @returns {Preflight | NightResult}
 */
export function preflight(o, c) {
  const { repoDir, log, until, maxCost, refuse } = c;
  const agent = agentCommand(o.agent);
  if (!agent)
    return refuse(
      "no agent command: pass --agent, set ABATTY_AGENT or agent.command in ~/.abatty/config.json",
      2,
    );
  const dirty = git(repoDir, "status", "--porcelain");
  if (dirty) return refuse(`dirty tree; commit or stash first:\n${dirty}`);
  spawnSync("git", ["fetch", "--prune"], { cwd: repoDir, stdio: "ignore" });

  const config = readAdoption(repoDir) || {};
  const base = String(config.baseBranch || "main");
  const prefix = String(config.branchPrefix || "adopt/standards");
  const stateFile = String(config.files?.state || "docs/ADOPTION_STATE.json");
  const decisionsFile = String(config.files?.decisions || "docs/ADOPTION_DECISIONS.md");
  const gateCmd = String(config.commands?.gate || "npm run gate:fast");
  const maxSessions = Number(config.maxSessionsPerPhase) || 2;
  /** @type {string[]} */
  const phases = (o.phases && o.phases.length ? o.phases : (config.phases || []).map(String)).map(
    String,
  );
  const date = new Date().toISOString().slice(0, 10);
  let branch = `${prefix}-${date}`;

  if (o.canaryOnly) branch = git(repoDir, "rev-parse", "--abbrev-ref", "HEAD");
  else if (git(repoDir, "show-ref", "--verify", `refs/heads/${branch}`))
    git(repoDir, "checkout", "-q", branch);
  else if (git(repoDir, "show-ref", "--verify", `refs/heads/${base}`))
    git(repoDir, "checkout", "-q", "-b", branch, base);
  else {
    const r = spawnSync("git", ["checkout", "-q", "-b", branch, `origin/${base}`], {
      cwd: repoDir,
      encoding: "utf8",
    });
    if (r.status !== 0) return refuse(`no ${base} branch to start from, locally or on origin`);
  }
  for (const f of HARNESS_FILES)
    if (!existsSync(join(repoDir, f)))
      return refuse(
        `harness incomplete on ${branch} - missing ${f}; commit the templates on ${base} first`,
      );
  if (
    !existsSync(join(repoDir, "abatty.config.json")) &&
    !existsSync(join(repoDir, ".claude/adoption.json"))
  )
    return refuse(
      `harness incomplete on ${branch} - no abatty.config.json (nor .claude/adoption.json); abatty init writes it, commit it on ${base} first`,
    );

  // Proven on the branch that will run, after the checkout: the hooks that matter are these.
  const selfTest = spawnSync(process.execPath, [".claude/hooks/self-test.mjs"], {
    cwd: repoDir,
    encoding: "utf8",
    env: { ...process.env, ABATTY_AGENT: agent },
  });
  if (selfTest.status !== 0) {
    log((selfTest.stdout || "") + (selfTest.stderr || ""));
    return refuse("harness self-test failed; fix it before running unattended");
  }
  /** @param {string} when */
  const harnessMoved = (when) => {
    const moved = git(repoDir, "diff", "--name-only", base, "--", ".claude/", "abatty.config.json");
    if (!moved) return "";
    log(
      `the harness (.claude/) differs from ${base} ${when}:\n${moved}\na night runs on the hooks a human committed; restore them (git checkout ${base} -- .claude/) or commit the change on ${base} first`,
    );
    return `harness moved ${when}`;
  };
  if (harnessMoved("at the start")) return refuse("the harness differs from the base at the start");

  const nightDir = join(repoDir, ".claude", "night", date);
  mkdirSync(nightDir, { recursive: true });
  const startedAt = new Date().toISOString();
  writeJson(join(repoDir, ".claude/night/run.json"), {
    startedAt,
    branch,
    base,
    until,
    maxCostUsd: maxCost,
  });

  // The MCP servers a session may have at all: the committed mcp.night.json, else none.
  let mcpConfig = join(repoDir, ".claude", "mcp.night.json");
  if (!existsSync(mcpConfig)) {
    mcpConfig = join(nightDir, "mcp-none.json");
    writeJson(mcpConfig, { mcpServers: {} });
  }
  const mcpServers = Object.keys(readJson(mcpConfig).mcpServers || {});
  const named = (config.mcpServers || []).map(String);
  for (const s of mcpServers)
    if (!named.includes(s))
      return refuse(
        `${mcpConfig} loads the MCP server '${s}' but adoption.json -> mcpServers does not name it: every call to it would be denied. Name it in both, or in neither.`,
      );
  log(`MCP at night: ${mcpServers.join(" ") || "none"} (${mcpConfig})`);

  // Pre-flight: the gate is green before anything is asked of the model.
  log(`[${clock()}] pre-flight: ${gateCmd}`);
  const gate = spawnSync(gateCmd, {
    cwd: repoDir,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(join(nightDir, "preflight-gate.txt"), (gate.stdout || "") + (gate.stderr || ""));
  if (gate.status !== 0) {
    log(
      `the gate is red on ${branch} before the night started (${gateCmd}); fix it by day, a night cannot:`,
    );
    for (const l of ((gate.stdout || "") + (gate.stderr || ""))
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-25))
      log(`  ${l}`);
    return refuse("the gate is red before the night started");
  }

  return {
    agent,
    config,
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
  };
}
