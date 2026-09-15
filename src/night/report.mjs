/**
 * `abatty night-report`: the learning distillation. A night leaves evidence in files - the
 * sessions' results, the Stop gate's receipts, the guards' denial log, the direction check's
 * findings, the state file, the decisions, the commits - and a human reads them in the
 * morning. This reads them first and proposes LESSONS: each a one-sentence draft in the
 * lessons catalogue's shape, with the evidence that produced it and the check that would catch
 * it next time. A proposal is a proposal; a human moves it into the catalogue, or not.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { git, parseJson, readConfig } from "../core/repo.mjs";
import { distil } from "./lessons.mjs";

export { distil } from "./lessons.mjs";
export { renderNightReport } from "./report-render.mjs";

/**
 * @typedef {{ name: string, phase: string, cost: number, denials: number, crashed: boolean, isError: boolean, sessionId: string }} SessionFact
 * @typedef {{ sessionId: string, phase: string | null, decision: string | null, reason: string | null, blocks: number, failedCheck: string | null }} ReceiptFact
 * @typedef {{ at: string, sessionId: string, phase: string | null, check: string, reason: string, block: number }} BlockFact
 * @typedef {{ at: string, tool: string, what: string, reason: string }} DenialFact
 * @typedef {{ kind: "guard" | "stop-gate" | "phase" | "decision" | "direction" | "session" | "canary", title: string, lesson: string, check: string, evidence: string[], count: number }} Lesson
 * @typedef {{ date: string, branch: string, base: string, run: any, sessions: SessionFact[], receipts: ReceiptFact[], blocks: BlockFact[], denials: DenialFact[], direction: string[], phases: any[], decisions: Record<string, number>, commits: string[], canary: { ok: boolean | null, findings: string[] }, lessons: Lesson[] }} NightReport
 */

/** @param {string} p @returns {any} */
function readJsonOrNull(p) {
  try {
    return parseJson(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
/** @param {string} p */
function listDir(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

/** The night folders a repository has, newest first. @param {string} repoDir */
export function nightDates(repoDir) {
  return listDir(join(repoDir, ".claude", "night"))
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort()
    .reverse();
}

/**
 * Gather the facts of one night.
 * @param {string} repoDir @param {string} [date] the night folder; the newest when absent
 * @returns {NightReport | null}
 */
export function gatherNight(repoDir, date) {
  const night = join(repoDir, ".claude", "night");
  const d = date || nightDates(repoDir)[0];
  if (!d || !existsSync(join(night, d))) return null;
  const dir = join(night, d);
  const run = readJsonOrNull(join(night, "run.json")) || {};
  const config = readConfig(repoDir) || {};
  const base = String(run.base || config.baseBranch || "main");
  const branch = String(run.branch || `${config.branchPrefix || "adopt/standards"}-${d}`);

  /** @type {SessionFact[]} */
  const sessions = [];
  for (const f of listDir(dir)
    .filter((x) => /^phase-.*\.json$/.test(x))
    .sort()) {
    const j = readJsonOrNull(join(dir, f));
    const phase = (f.match(/^phase-(.+?)-\d{6}\.json$/) || [null, "?"])[1] || "?";
    sessions.push({
      name: f.replace(/\.json$/, ""),
      phase,
      cost: Number(j?.total_cost_usd) || 0,
      denials: Array.isArray(j?.permission_denials) ? j.permission_denials.length : 0,
      crashed: !j,
      isError: j?.is_error === true,
      sessionId: j?.session_id ? String(j.session_id) : "",
    });
  }
  /** @type {ReceiptFact[]} */
  const receipts = [];
  for (const f of listDir(night).filter((x) => /^stop-gate-.*\.json$/.test(x))) {
    const r = readJsonOrNull(join(night, f));
    if (!r || typeof r.at !== "string" || !r.at.startsWith(d)) continue;
    const failed = Array.isArray(r.checks)
      ? r.checks.find((/** @type {any} */ c) => c && c.ok === false)
      : null;
    receipts.push({
      sessionId: String(r.sessionId || ""),
      phase: r.phase === undefined ? null : r.phase,
      decision: r.decision ?? null,
      reason: r.reason ?? null,
      blocks: Number(r.blockNumber) || 0,
      failedCheck: failed ? String(failed.check) : null,
    });
  }
  /** @type {BlockFact[]} */
  const blocks = [];
  const blocksLog = join(night, "stop-blocks.jsonl");
  if (existsSync(blocksLog))
    for (const line of readFileSync(blocksLog, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const x = readJsonOrNullText(line);
      if (!x || typeof x.at !== "string" || !x.at.startsWith(d)) continue;
      blocks.push({
        at: x.at,
        sessionId: String(x.sessionId || ""),
        phase: x.phase === undefined ? null : x.phase,
        check: String(x.check || "?"),
        reason: String(x.reason || ""),
        block: Number(x.block) || 0,
      });
    }
  /** @type {DenialFact[]} */
  const denials = [];
  const log = join(night, "guard-denials.jsonl");
  if (existsSync(log))
    for (const line of readFileSync(log, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const x = readJsonOrNullText(line);
      if (!x || typeof x.at !== "string" || !x.at.startsWith(d)) continue;
      denials.push({
        at: x.at,
        tool: String(x.tool || ""),
        what: String(x.command || x.path || ""),
        reason: String(x.reason || ""),
      });
    }
  const directionText = existsSync(join(dir, "direction.txt"))
    ? readFileSync(join(dir, "direction.txt"), "utf8")
    : "";
  const direction = directionText
    .split(/\r?\n/)
    .filter((l) => /loosen|differ|rose|deleted|raised|dropped|turned off|switched off/i.test(l));
  const state = readJsonOrNull(
    join(repoDir, String(config.files?.state || "docs/ADOPTION_STATE.json")),
  );
  const phases = Array.isArray(state?.phases) ? state.phases : [];
  /** @type {Record<string, number>} */
  const decisions = {};
  const decisionsFile = join(
    repoDir,
    String(config.files?.decisions || "docs/ADOPTION_DECISIONS.md"),
  );
  if (existsSync(decisionsFile))
    for (const m of readFileSync(decisionsFile, "utf8").matchAll(/decision:\s*([a-z][a-z0-9-]*)/g))
      decisions[m[1] || "?"] = (decisions[m[1] || "?"] || 0) + 1;
  const commits = git(repoDir, "log", "--format=%h %s", `${base}..${branch}`)
    .split("\n")
    .filter(Boolean);
  const canaryJson = readJsonOrNull(join(dir, "canary.json"));
  const canary = {
    ok: canaryJson ? canaryJson.is_error !== true : null,
    findings: /** @type {string[]} */ ([]),
  };

  const facts = {
    date: d,
    branch,
    base,
    run,
    sessions,
    receipts,
    blocks,
    denials,
    direction,
    phases,
    decisions,
    commits,
    canary,
    lessons: /** @type {Lesson[]} */ ([]),
  };
  facts.lessons = distil(facts);
  return facts;
}

/** @param {string} line @returns {any} */
function readJsonOrNullText(line) {
  try {
    return parseJson(line);
  } catch {
    return null;
  }
}
