/**
 * One session of the agent's headless mode under the night flags, and the facts the runner
 * reads from it: the result JSON (cost, denials, session id, the answer), a crash (a non-zero
 * exit WITHOUT a result: the CLI failing to run, never a session that worked and stopped), and
 * the deadline arithmetic. Numbers are read and written as JSON, never through a locale: the
 * French decimal comma of the first week cannot happen here.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseJson } from "../core/repo.mjs";
import { agentFromEnv } from "../core/env.mjs";
import { PRIMARY, sessionArgs } from "../agents/index.mjs";
import { tokensOf } from "./allowance.mjs";

/**
 * @typedef {{ exit: number, crashed: boolean, parsed: boolean, cost: number, tokens: number, denials: number, sessionId: string, isError: boolean, result: string, json: string, stderr: string }} SessionResult
 * @typedef {{ agent: string, mode: string, model: string, effort: string, mcpConfig: string, log: (line: string) => void, adapter?: import("../agents/index.mjs").Adapter, sandbox?: import("./sandbox-drivers.mjs").Sandbox | null }} SessionOptions
 */

/**
 * The agent's executable, from the machine that runs the night, never from the repository:
 * the explicit option, else ABATTY_AGENT, else `agent.command` in ~/.abatty/config.json.
 * @param {string} [explicit]
 */
export function agentCommand(explicit = "") {
  if (explicit) return explicit;
  const fromEnv = agentFromEnv();
  if (fromEnv) return fromEnv;
  try {
    const cfg = parseJson(readFileSync(join(homedir(), ".abatty", "config.json"), "utf8"));
    return typeof cfg?.agent?.command === "string" ? cfg.agent.command : "";
  } catch {
    return "";
  }
}

/**
 * The deadline: "HH:MM" is today at that hour, tomorrow when it is already past; "+Nmin" or
 * "+Nh" is relative to now. Returns epoch milliseconds.
 * @param {string} until @param {Date} [now]
 */
export function deadlineOf(until, now = new Date()) {
  const rel = until.match(/^\+(\d+)\s*(min|m|h)$/i);
  if (rel) {
    const n = Number(rel[1]);
    return now.getTime() + n * (/^h$/i.test(rel[2] || "") ? 3_600_000 : 60_000);
  }
  const m = until.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`until: "${until}" is neither HH:MM nor +Nmin`);
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** @param {string} p @returns {any} */
function readJsonOrNull(p) {
  try {
    return parseJson(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Run one session. Output goes to `<outBase>.json` and `<outBase>.stderr.txt`; the env carries
 * the night's variables for the hooks. Runs through a shell on Windows only (a `.cmd` shim
 * needs one); elsewhere the executable is called directly, so a prompt starting with "/" is
 * never rewritten into a path. With a sandbox, the executable and its arguments go through the
 * driver's argv: the session runs inside the boundary, the hooks with it.
 * @param {{ repoDir: string, prompt: string, budget: number, name: string, outBase: string, env: Record<string, string | undefined> }} run
 * @param {SessionOptions} o
 * @returns {SessionResult}
 */
export function runSession(run, o) {
  const json = `${run.outBase}.json`;
  const stderrFile = `${run.outBase}.stderr.txt`;
  o.log(`[${clock()}] ${run.name}`);
  const args = sessionArgs(o.adapter || PRIMARY, {
    prompt: run.prompt,
    mode: o.mode,
    budget: run.budget,
    model: o.model,
    effort: o.effort,
    mcpConfig: o.mcpConfig,
    name: run.name,
  });
  const w = o.sandbox
    ? // PATH is deliberately not forwarded by name: a container has its own, and handing it the
      // host's would replace the image's tools with paths that do not exist inside it. The shim
      // reaches a container run through the image, not through this variable.
      o.sandbox.wrap(
        o.agent,
        args,
        Object.keys(run.env).filter((n) => n !== "PATH"),
      )
    : { cmd: o.agent, args };
  const win = process.platform === "win32";
  const r = spawnSync(win ? `"${w.cmd}"` : w.cmd, win ? w.args.map(quoteWin) : w.args, {
    cwd: run.repoDir,
    encoding: "utf8",
    shell: win,
    env: { ...process.env, ...run.env },
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(json, r.stdout || "");
  writeFileSync(stderrFile, r.stderr || "");
  const exit = r.status ?? 1;
  const parsed = readJsonOrNull(json);
  const cost = Number(parsed?.total_cost_usd) || 0;
  const denials = Array.isArray(parsed?.permission_denials) ? parsed.permission_denials.length : 0;
  const crashed = exit !== 0 && !parsed;
  o.log(`  exit ${exit}, cost ${cost.toFixed(2)} USD, ${denials} permission denial(s)`);
  if (crashed) {
    o.log(`  the session did not produce a result (exit ${exit}). stderr:`);
    for (const l of String(r.stderr || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-12))
      o.log(`  ${l}`);
  }
  return {
    exit,
    crashed,
    parsed: Boolean(parsed),
    cost,
    denials,
    tokens: tokensOf(parsed),
    sessionId: parsed?.session_id ? String(parsed.session_id) : "",
    isError: parsed?.is_error === true,
    result: parsed?.result === undefined || parsed?.result === null ? "" : String(parsed.result),
    json,
    stderr: stderrFile,
  };
}

/** @param {string} a */
function quoteWin(a) {
  return /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

/** HH:MM for the log. */
export function clock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
