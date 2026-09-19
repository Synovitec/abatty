/**
 * The report: one JSON per measurement, under .abatty/reports/, the shape the terminal status
 * screen and the dashboard read. A report is a reading, dated, never rewritten; the newest one
 * is the repository's state. Nights add their own facts (the state file, the decisions, the
 * receipts under the agent's night folder) and the report gathers what exists.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { measure } from "./gap-analysis.mjs";
import { git, readAdoption, readJsonFile, readPackage } from "./repo.mjs";
import { drift } from "./doctor.mjs";
import { detectWorkspaces } from "../presets/workspaces.mjs";
import { scanFiles, allowList, scrubConfig } from "./scrub.mjs";
import { cacheKey, readCache, writeCache } from "./cache.mjs";
import { bypassReading } from "./bypass.mjs";
import { changelogPairs, commitsOf, coupledFindings } from "./coupled.mjs";
import { pushRange } from "./gate.mjs";

/**
 * @typedef {{
 *   version: 1,
 *   abatty: string,
 *   repo: string, name: string, date: string, at: string, branch: string, commit: string,
 *   score: number, applicable: number, waived: number,
 *   enforced: import("./gap-analysis.mjs").Enforced,
 *   families: { name: string, present: number, partial: number, missing: number, na: number, waived: number }[],
 *   findings: import("../rules/index.mjs").Finding[],
 *   problems: string[],
 *   profiles: string[],
 *   stage: string, stageFrom: string,
 *   phase: { id: string, title: string, held: number, applicable: number } | null,
 *   plan: { id: string, title: string, held: number, applicable: number }[],
 *   workspaces: { path: string, name: string, preset: string, from: string }[],
 *   harness: { present: boolean, drift: number, missing: number },
 *   scrub: { enabled: boolean, lines: number },
 *   night: { state: unknown | null, decisions: number, lastReport: string | null, lastRun: unknown | null },
 *   bypass: { commits: number, bypassed: number, reasoned: number, rate: number },
 * }} Report
 */

export const REPORT_DIR = join(".abatty", "reports");

/** The newest facts of the last night, when any. @param {string} repoDir */
function nightFacts(repoDir) {
  const adoption = readAdoption(repoDir);
  const stateFile = adoption?.files?.state || "docs/ADOPTION_STATE.json";
  const decisionsFile = adoption?.files?.decisions || "docs/ADOPTION_DECISIONS.md";
  const state = readJsonFile(repoDir, stateFile);
  const decisions = existsSync(join(repoDir, decisionsFile))
    ? (readFileSync(join(repoDir, decisionsFile), "utf8").match(/^- \*\*\d{4}-\d{2}-\d{2}/gm) || [])
        .length
    : 0;
  const reports = existsSync(join(repoDir, "docs"))
    ? readdirSync(join(repoDir, "docs"))
        .filter((f) => /^ADOPTION_REPORT_\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort()
    : [];
  const nightRoot = join(repoDir, ".claude", "night");
  const lastRun = existsSync(join(nightRoot, "run.json"))
    ? readJsonFile(nightRoot, "run.json")
    : null;
  return {
    state,
    decisions,
    lastReport: reports.at(-1) ? `docs/${reports.at(-1)}` : null,
    lastRun,
  };
}

/**
 * The commits of the pushed range that broke a rule the hook enforces at commit time: the hook
 * cannot have run and let them through, so it was not installed or it was bypassed.
 * @param {string} repoDir
 */
function bypassOf(repoDir) {
  try {
    const range = pushRange(repoDir);
    const git = (/** @type {string[]} */ ...a) =>
      String(execFileSync("git", a, { cwd: repoDir, encoding: "utf8" }) || "").trim();
    const commits = commitsOf(git, range);
    const violations = coupledFindings(
      commits,
      changelogPairs(/** @type {any} */ (readAdoption(repoDir) || {})),
    ).map((f) => ({ sha: f.path, detail: f.detail }));
    const r = bypassReading(commits, violations);
    return {
      commits: r.commits,
      bypassed: r.bypassed.length,
      reasoned: r.reasoned.length,
      rate: r.rate,
    };
  } catch {
    // A reading that cannot be taken is not a finding: a repository with no range, no git or no
    // history says nothing rather than reporting a rate it invented.
    return { commits: 0, bypassed: 0, reasoned: 0, rate: 0 };
  }
}

/**
 * Measure the repository (its full catalog: built-in rules, its own, its waivers) and assemble
 * the report. Writes it under .abatty/reports/ unless `write` is false.
 * @param {string} repoDir @param {{ write?: boolean, abattyVersion?: string, cache?: boolean }} [o]
 */
export async function buildReport(repoDir, o = {}) {
  // The reading of an unchanged tree is the reading. The key is the content of everything a rule
  // could read, so a hit cannot turn a finding into a pass; anything it cannot account for is a
  // miss and the catalog runs.
  const key = o.cache === false ? null : cacheKey(repoDir, { version: o.abattyVersion });
  const cached = key ? readCache(repoDir, key) : null;
  if (cached) return /** @type {Report} */ (cached);
  const gap = await measure(repoDir);
  const families = gap.families.map((name) => ({
    name,
    present: gap.findings.filter((f) => f.family === name && f.status === "present").length,
    partial: gap.findings.filter((f) => f.family === name && f.status === "partial").length,
    missing: gap.findings.filter((f) => f.family === name && f.status === "missing").length,
    na: gap.findings.filter((f) => f.family === name && f.status === "n/a").length,
    waived: gap.findings.filter((f) => f.family === name && f.status === "waived").length,
  }));
  const d = drift(repoDir);
  const harnessPresent = existsSync(join(repoDir, ".claude", "hooks", "self-test.mjs"));
  /** @type {Report} */
  const report = {
    version: 1,
    abatty: o.abattyVersion || "",
    repo: repoDir,
    name: readPackage(repoDir).name || gap.name,
    date: gap.date,
    at: new Date().toISOString(),
    branch: git(repoDir, "rev-parse", "--abbrev-ref", "HEAD"),
    commit: git(repoDir, "rev-parse", "--short", "HEAD"),
    score: gap.score,
    applicable: gap.applicable,
    enforced: gap.enforced,
    waived: gap.waived,
    families,
    findings: gap.findings,
    problems: gap.problems,
    profiles: gap.profiles,
    stage: gap.stage,
    stageFrom: gap.stageFrom,
    // The phase the repository is on and the standing of every phase of its plan: the number a
    // reader acts on, beside the score that is only a trend.
    phase: gap.phase,
    plan: gap.plan,
    workspaces: detectWorkspaces(repoDir, readAdoption(repoDir)).map((w) => ({
      path: w.path,
      name: w.name,
      preset: w.presetId,
      from: w.from,
    })),
    harness: {
      present: harnessPresent,
      drift: d.filter((x) => x.state === "differs").length,
      missing: d.filter((x) => x.state === "missing").length,
    },
    scrub: {
      enabled: scrubConfig(repoDir).enabled,
      lines: scrubConfig(repoDir).enabled
        ? scanFiles(repoDir, { allow: allowList(repoDir) }).length
        : 0,
    },
    night: nightFacts(repoDir),
    // What got past the hook in this push, and at what rate. A bypass nobody can see afterwards
    // is a gate with a hole nobody can measure.
    bypass: bypassOf(repoDir),
  };
  if (key) writeCache(repoDir, key, report);
  if (o.write !== false) {
    const dir = join(repoDir, REPORT_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${gap.date}.json`), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(dir, "latest.json"), JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}

/** The newest report on disk, or null. @param {string} repoDir @returns {Report | null} */
export function latestReport(repoDir) {
  return readJsonFile(repoDir, join(REPORT_DIR, "latest.json"));
}

/** Every dated report on disk, oldest first. @param {string} repoDir @returns {Report[]} */
export function allReports(repoDir) {
  const dir = join(repoDir, REPORT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => readJsonFile(dir, f))
    .filter(Boolean);
}
