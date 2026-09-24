/**
 * The ratchet: every mechanical rule the linter cannot state, measured by a probe, compared
 * against the committed baseline, refused when a number goes the wrong way. Standard §2.2.
 *
 * A probe is data with one function: `{ metric, kind, standard, title, why, scan, controls }`.
 * `scan` reads the repository context and returns findings with a path (and a weight when the
 * metric measures excess, not count); the total is the sum of the weights and the per-file
 * debt is the sum per path. Two kinds: HARD must be zero, now and forever; RATCHET holds
 * today's number and may only fall, per total AND per file, so debt cannot relocate. A probe
 * with no failing control case is not added: `controls` carries at least one case the probe
 * must report and one it must not, and `abatty ratchet --controls` runs them.
 *
 * Nothing of the repository is executed: a probe reads files and runs git, no more.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readConfig } from "../core/repo.mjs";
import { probes as sizeProbes } from "./probes/size.mjs";
import { probes as docsProbes } from "./probes/docs.mjs";
import { probes as freshnessProbes } from "./probes/freshness.mjs";
import { probes as successionProbes } from "./probes/succession.mjs";
import { probes as frontMatterProbes } from "./probes/frontmatter.mjs";
import { probes as catchLogProbes } from "./probes/catchlog.mjs";
import { probes as weakRandomProbes } from "./probes/weakrandom.mjs";
import { probes as jsdocProbes } from "./probes/jsdoc.mjs";
import { probes as codeProbes } from "./probes/code.mjs";
import { probes as changeProbes } from "./probes/change.mjs";
import { probes as startupProbes } from "./probes/startup.mjs";
import { probes as boundaryProbes } from "./probes/boundary.mjs";
import { probes as apiProbes } from "./probes/api.mjs";
import { probes as shapeProbes } from "./probes/shape.mjs";
import { probes as coverageProbes } from "./probes/coverage.mjs";
import { probes as nonNullProbes } from "./probes/nonnull.mjs";
import { probes as sqlDateProbes } from "./probes/sqldate.mjs";
import { probes as refactorProbes } from "./probes/refactor.mjs";
import { probes as cloneProbes } from "./probes/clones.mjs";
import { DEFAULT_CONFIG, baselinePath, resolveConfig } from "./config.mjs";

// Only what a caller outside this folder uses: the rest were re-exports nobody imported, which
// the dead-code gate names once it runs (CODE.6). `config.mjs` remains their home.
export { DEFAULT_CONFIG } from "./config.mjs";
export { lockEarned, readBaseline, writeBaseline } from "./baseline.mjs";
import { probeVersion } from "./baseline.mjs";

/**
 * @typedef {import("../rules/context.mjs").RepoContext} RepoContext
 * @typedef {"hard" | "ratchet"} Kind
 * @typedef {{ path: string, line?: number, detail?: string, weight?: number }} Finding
 * @typedef {{ scanned: number, findings: Finding[], skipped?: string }} ProbeResult
 * @typedef {{ files: Record<string, string>, message: string, date?: string }} ControlCommit
 * @typedef {{ name: string, files?: Record<string, string>, commits?: ControlCommit[], range?: string, config?: Partial<RatchetConfig>, expect: number }} Control
 * @typedef {{ config: RatchetConfig, range: string }} ProbeOptions
 * @typedef {{
 *   metric: string,
 *   kind: Kind,
 *   standard: string[],
 *   title: string,
 *   why: string,
 *   axis?: string,
 *   lossAt?: number,
 *   version?: number,
 *   approximates?: string,
 *   emptyScanOk?: boolean,
 *   optIn?: boolean,
 *   probation?: boolean,
 *   scan: (ctx: RepoContext, o: ProbeOptions) => ProbeResult,
 *   controls: Control[],
 *   source?: string,
 * }} Probe
 * @typedef {{ match: string, kind: string, max: number }} KindBudget
 * @typedef {{
 *   local: string,
 *   include: string[],
 *   exclude: string[],
 *   hard: string[],
 *   ratchet: string[],
 *   mustScan: string[],
 *   cap: number,
 *   defaultMax: number,
 *   contextMax: number,
 *   barrelMax: number,
 *   kinds: KindBudget[],
 *   exempt: string[],
 *   envModule: string,
 *   citationsExempt: string[],
 *   changelog: string,
 *   changelogFragments: string,
 *   changelogRequiredFor: string[],
 *   coupled: unknown[],
 *   enable: string[],
 *   boundedBy?: string[],
 *   secretFields?: string[],
 *   moneyFields?: string[],
 *   pageGuards?: { pages: string, guard: string }[],
 *   shapeList?: string,
 * }} RatchetConfig
 *   `enable`: the opt-in probes this repository runs. A probe marked `optIn` reads one stack's
 *   conventions; switched on for every repository, an update would turn each one red on a
 *   metric it never asked for. The keys after it configure those probes.
 * @typedef {{ metric: string, kind: Kind, value: number, scanned: number, findings: Finding[], debt: Record<string, number>, skipped?: string, probe: Probe }} Measurement
 * @typedef {"ok" | "improved" | "regressed" | "hard-fail" | "scanned-zero" | "unbaselined" | "redefined" | "probation" | "skipped"} VerdictStatus
 * @typedef {{ metric: string, kind: Kind, status: VerdictStatus, value: number, floor: number | null, scanned: number, messages: string[], findings: Finding[], floorNote?: string, approximates?: string }} Verdict
 * @typedef {{ at: string, was: number, now: number, reason: string, owner: string }} BaselineEntry
 * @typedef {{ measuredAt: string, note?: string, score?: number, hard?: string[], metrics: Record<string, number>, scanned?: Record<string, number>, debt: Record<string, Record<string, number>>, versions?: Record<string, number>, entries?: Record<string, BaselineEntry>, [k: string]: unknown }} Baseline
 */

/** @type {Probe[]} */
export const BUILTIN_PROBES = [
  ...sizeProbes,
  ...codeProbes,
  ...docsProbes,
  ...freshnessProbes,
  ...successionProbes,
  ...frontMatterProbes,
  ...changeProbes,
  ...startupProbes,
  ...boundaryProbes,
  ...apiProbes,
  ...shapeProbes,
  ...refactorProbes,
  ...cloneProbes,
  ...coverageProbes,
  ...nonNullProbes,
  ...sqlDateProbes,
  ...catchLogProbes,
  ...weakRandomProbes,
  ...jsdocProbes,
].map((p) => ({ ...p, source: "abatty" }));

/**
 * Validate a probe's shape. Returns the problems; an empty list is a valid probe.
 * @param {any} p @param {Set<string>} builtin
 */
export function validateProbe(p, builtin) {
  /** @type {string[]} */
  const problems = [];
  const where = `probe ${p?.metric ?? "(no metric)"}`;
  if (!p || typeof p !== "object") return [`${where}: not an object`];
  if (typeof p.metric !== "string" || !/^[a-z][a-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/.test(p.metric))
    problems.push(`${where}: metric must be family.name (lower-case family, camelCase name)`);
  else if (builtin.has(p.metric)) problems.push(`${where}: a built-in metric name`);
  if (p.kind !== "hard" && p.kind !== "ratchet")
    problems.push(`${where}: kind must be hard or ratchet`);
  if (typeof p.title !== "string" || !p.title) problems.push(`${where}: title missing`);
  if (typeof p.why !== "string" || !p.why) problems.push(`${where}: why missing`);
  if (typeof p.scan !== "function") problems.push(`${where}: scan is not a function`);
  if (p.approximates !== undefined && typeof p.approximates !== "string")
    problems.push(`${where}: approximates must be a string (what the count stands in for)`);
  if (!Array.isArray(p.controls)) problems.push(`${where}: controls missing`);
  else {
    if (!p.controls.some((/** @type {any} */ c) => c && c.expect > 0))
      problems.push(
        `${where}: no failing control case (one the probe must report); a probe without one is not added`,
      );
    if (!p.controls.some((/** @type {any} */ c) => c && c.expect === 0))
      problems.push(`${where}: no clean control case (one the probe must not report)`);
  }
  return problems;
}

/**
 * The probes of a repository: the built-in set less `exclude` (or only `include`), the opt-in
 * ones it names in `enable`, plus the repository's own from `abatty.probes.mjs`, validated. An
 * opt-in probe that is not enabled does not reserve its name, so a repository that wrote its own
 * probe of that name keeps it until it enables the package's.
 * @param {string} repoDir @param {RatchetConfig} config
 * @returns {Promise<{ probes: Probe[], problems: string[] }>}
 */
export async function loadProbes(repoDir, config) {
  /** @type {string[]} */
  const problems = [];
  const enabled = Array.isArray(config.enable) ? config.enable : [];
  let probes = BUILTIN_PROBES.filter(
    (p) =>
      (!p.optIn || enabled.includes(p.metric)) &&
      (!config.include.length || config.include.includes(p.metric)) &&
      !config.exclude.includes(p.metric),
  );
  for (const m of enabled)
    if (!BUILTIN_PROBES.some((p) => p.metric === m && p.optIn))
      problems.push(`ratchet.enable: ${m} is not an opt-in probe of this version`);
  const local = resolve(repoDir, config.local);
  if (existsSync(local)) {
    const builtin = new Set(
      BUILTIN_PROBES.filter((p) => !p.optIn || enabled.includes(p.metric)).map((p) => p.metric),
    );
    try {
      const mod = await import(pathToFileURL(local).href + `?t=${Date.now()}`);
      const list = Array.isArray(mod.probes)
        ? mod.probes
        : Array.isArray(mod.default)
          ? mod.default
          : null;
      if (!list) problems.push(`${config.local}: export \`probes\` (an array) or a default array`);
      else
        for (const p of list) {
          const errs = validateProbe(p, builtin);
          if (errs.length) problems.push(...errs.map((e) => `${config.local}: ${e}`));
          else probes.push({ ...p, source: config.local });
        }
    } catch (e) {
      problems.push(`${config.local}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const seen = new Set();
  probes = probes.filter((p) => (seen.has(p.metric) ? false : (seen.add(p.metric), true)));
  return { probes, problems };
}

/** The kind of a metric: the config's override, then the baseline's promotion, then the probe's own. @param {Probe} p @param {RatchetConfig} config @param {Baseline | null} baseline */
export function kindOf(p, config, baseline) {
  if (config.hard.includes(p.metric)) return "hard";
  if (config.ratchet.includes(p.metric)) return "ratchet";
  if (baseline?.hard?.includes(p.metric)) return "hard";
  return p.kind;
}

/**
 * Run every probe over the context. A probe that throws is a finding of its own, never a crash.
 * @param {Probe[]} probes @param {RepoContext} ctx @param {ProbeOptions} o @param {Baseline | null} baseline
 * @returns {Measurement[]}
 */
export function measureAll(probes, ctx, o, baseline) {
  return probes.map((probe) => {
    /** @type {ProbeResult} */
    let r;
    try {
      r = probe.scan(ctx, o);
    } catch (e) {
      r = {
        scanned: 0,
        findings: [
          {
            path: "(probe)",
            detail: `the probe threw: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
      };
    }
    /** @type {Record<string, number>} */
    const debt = {};
    let value = 0;
    for (const f of r.findings) {
      const w = typeof f.weight === "number" ? f.weight : 1;
      value += w;
      debt[f.path] = (debt[f.path] || 0) + w;
    }
    const m = /** @type {Measurement} */ ({
      metric: probe.metric,
      kind: kindOf(probe, o.config, baseline),
      value,
      scanned: r.scanned,
      findings: r.findings,
      debt,
      probe,
    });
    if (r.skipped) m.skipped = r.skipped;
    return m;
  });
}

/**
 * Judge every measurement against the baseline. HARD: zero or fails. RATCHET: the total and
 * every file's debt hold or fall; a file not in the list carries none. Scanned zero fails when
 * the baseline last saw files (or the config insists): a moved path must not go green forever.
 * A metric the baseline does not know fails when it is not zero: run `abatty baseline`.
 * @param {Measurement[]} measurements @param {Baseline | null} baseline @param {RatchetConfig} config
 * @returns {Verdict[]}
 */
export function compare(measurements, baseline, config) {
  return measurements.map((m) => onProbation(m, judgeOne(m, baseline, config)));
}

/**
 * A probe on probation is measured and shown, and a verdict that would fail the run is reported
 * as `probation` instead. A blocking check lives on its false positives: one wrong red is a
 * reason to reach for the bypass, so a new or heuristic probe earns the right to block by running
 * clean on a named repository first, the way a preset does.
 * @param {Measurement} m @param {Verdict} verdict @returns {Verdict}
 */
function onProbation(m, verdict) {
  if (!m.probe.probation || !failed([verdict])) return verdict;
  return {
    ...verdict,
    status: "probation",
    messages: [
      ...verdict.messages,
      `on probation: counted and shown, never failing a run until a named repository has run it clean (would read ${verdict.status})`,
    ],
  };
}

/**
 * The verdict of one measurement for a status, carrying what every verdict carries: the proxy's
 * own words, and who raised the floor and why.
 * @param {Measurement} m @param {Baseline | null} baseline
 */
function verdictMaker(m, baseline) {
  const floor = baseline?.metrics?.[m.metric];
  const entry = baseline?.entries?.[m.metric];
  /** @param {VerdictStatus} status @param {string[]} messages @returns {Verdict} */
  return (status, messages) => ({
    metric: m.metric,
    kind: m.kind,
    status,
    value: m.value,
    floor: typeof floor === "number" ? floor : null,
    scanned: m.scanned,
    messages,
    findings: m.findings,
    // A probe that stands in for something it cannot measure says so on every reading, not in
    // a document nobody opens while the number is red.
    ...(m.probe.approximates ? { approximates: m.probe.approximates } : {}),
    ...(entry
      ? {
          floorNote: `floor raised on ${entry.at} by ${entry.owner}, ${entry.was} → ${entry.now}: ${entry.reason}`,
        }
      : {}),
  });
}

/**
 * Each file whose debt rose above its floor, with every finding it carries: a count cannot say
 * which one is new, and a list that shows three of twelve reads as "you introduced these three"
 * when it knows no such thing. The whole file is what the reader has to look at.
 * @param {Measurement} m @param {Record<string, number>} known
 */
function worsenedFiles(m, known) {
  /** @type {string[]} */
  const lines = [];
  for (const [path, n] of Object.entries(m.debt)) {
    const was = known[path] ?? 0;
    if (n <= was) continue;
    lines.push(
      `per file: ${path} ${was} → ${n}${was === 0 ? " (a file not on the list carries none)" : ""}`,
    );
    for (const f of m.findings) if (f.path === path) lines.push(`  ${where(f)}`);
  }
  return lines;
}

/** One measurement judged against the baseline, as `compare` describes. @param {Measurement} m @param {Baseline | null} baseline @param {RatchetConfig} config @returns {Verdict} */
function judgeOne(m, baseline, config) {
  const floor = baseline?.metrics?.[m.metric];
  const lastScanned = baseline?.scanned?.[m.metric] ?? 0;
  const v = verdictMaker(m, baseline);
  if (m.skipped) return v("skipped", [m.skipped]);
  // A floor is only comparable to a number counted the same way. A baseline that records no
  // version at all predates the field and is taken at its word; one that records a different
  // version is reported, because comparing it would be arithmetic on two different questions.
  const wroteUnder = baseline?.versions?.[m.metric];
  const now = probeVersion(m);
  if (typeof wroteUnder === "number" && wroteUnder !== now)
    return v("redefined", [
      `the floor ${floor ?? "(none)"} was written under definition ${wroteUnder} of this metric and the probe now counts definition ${now}; the two numbers are not the same question. Re-read the probe, then run \`abatty baseline\` to record today's number under the current definition`,
    ]);
  if (
    m.scanned === 0 &&
    !m.probe.emptyScanOk &&
    (lastScanned > 0 || config.mustScan.includes(m.metric))
  )
    return v("scanned-zero", [
      `scanned 0 files (the baseline saw ${lastScanned}); a moved path or a mistyped pattern reports green forever - fix the probe's paths, never the floor`,
    ]);
  const list = m.findings.slice(0, 12).map(where);
  if (m.kind === "hard") {
    if (m.value > 0)
      return v("hard-fail", [
        `${m.value} finding(s); a HARD metric is zero, now and forever`,
        ...list,
      ]);
    return v("ok", []);
  }
  if (typeof floor !== "number") {
    if (m.value > 0)
      return v("unbaselined", [
        `${m.value} finding(s) and no floor in the baseline; run \`abatty baseline\` to record today's number as the floor`,
        ...list,
      ]);
    return v("ok", []);
  }
  const perFile = worsenedFiles(m, baseline?.debt?.[m.metric] || {});
  if (m.value > floor || perFile.length)
    return v("regressed", [
      m.value > floor
        ? `total ${floor} → ${m.value}`
        : `total ${m.value} within the floor ${floor}, but a file worsened`,
      ...perFile,
      ...(m.value > floor && !perFile.length ? list : []),
      "two ways out: bring the count back to the floor by fixing findings above, or record the rise with `abatty baseline --reason <why> --owner <who>`",
    ]);
  // Bidirectional: a floor ABOVE the current value is a finding, not a silent pass. Left
  // unlocked it is slack the gate keeps accepting - findings that no longer exist may come
  // back for free, and the number stops meaning what it says. So an improvement is locked in
  // the change that earned it, which is also the only moment anyone knows why it moved.
  if (m.value < floor)
    return v("improved", [
      `${floor} → ${m.value}: the floor is ${floor - m.value} above the current value, so the gate is still accepting ${floor - m.value} finding(s) that no longer exist. Lock it in this change: a run outside CI writes the lowered floor when nothing else fails, and \`abatty baseline\` does the same by hand; commit the baseline with the change.`,
    ]);
  return v("ok", []);
}

/** @param {Finding} f */
function where(f) {
  return `${f.path}${f.line ? ":" + f.line : ""}${f.detail ? " · " + f.detail : ""}${typeof f.weight === "number" && f.weight !== 1 ? ` (+${f.weight})` : ""}`;
}

/**
 * True when the run must fail. `improved` is among them: a floor left above the value it now
 * measures is slack the gate keeps accepting, so the run is red until `abatty baseline` records
 * the number that was earned. Every status here is cured by a change, never by editing a floor
 * upward.
 * @param {Verdict[]} verdicts
 */
export function failed(verdicts) {
  return verdicts.some((v) =>
    ["regressed", "hard-fail", "scanned-zero", "unbaselined", "improved", "redefined"].includes(
      v.status,
    ),
  );
}

/**
 * The readability score (standard AIR.2): each metric earns full marks at zero and nothing at
 * the count where the property is lost (`lossAt`), averaged per axis, the axes averaged. A trend
 * to watch, never a gate: every term is already ratcheted on its own.
 * @param {Measurement[]} measurements
 */
export function scoreOf(measurements) {
  /** @type {Record<string, number[]>} */
  const axes = {};
  for (const m of measurements) {
    const axis = m.probe.axis;
    if (!axis || m.skipped) continue;
    const loss = m.probe.lossAt || 50;
    (axes[axis] ||= []).push(Math.max(0, 1 - m.value / loss));
  }
  const names = Object.keys(axes);
  if (!names.length) return { score: 100, axes: {} };
  /** @type {Record<string, number>} */
  const perAxis = {};
  for (const a of names) {
    const terms = axes[a] || [];
    perAxis[a] = Math.round((100 * terms.reduce((s, x) => s + x, 0)) / terms.length);
  }
  const score = Math.round(names.reduce((s, a) => s + (perAxis[a] || 0), 0) / names.length);
  return { score, axes: perAxis };
}

/**
 * The configuration of a repository, for the commands: the one config (abatty.config.json at
 * the root over the older .claude/adoption.json), resolved for the ratchet.
 * @param {string} repoDir
 */
export function ratchetSetup(repoDir) {
  const adoption = readConfig(repoDir) || {};
  return { adoption, config: resolveConfig(adoption), baselineRel: baselinePath(adoption) };
}

/**
 * A verdict's findings split by whether this change introduced them. A finding sits in a file the
 * range touched, or it does not; the first is the author's to fix now and the second is the
 * repository's standing debt, and a gate that reports them in one list teaches its readers to
 * scroll past both.
 *
 * Touching a file is not the same as causing the finding, so the split is named for what it can
 * actually know: `introduced` means the finding is in a file this change edited.
 * @param {Verdict[]} verdicts @param {string[]} changed
 * @returns {{ introduced: { metric: string, finding: Finding }[], standing: { metric: string, finding: Finding }[] }}
 */
export function splitByRange(verdicts, changed) {
  const touched = new Set(changed);
  /** @type {{ metric: string, finding: Finding }[]} */
  const introduced = [];
  /** @type {{ metric: string, finding: Finding }[]} */
  const standing = [];
  for (const v of verdicts)
    for (const f of v.findings)
      (touched.has(f.path) ? introduced : standing).push({ metric: v.metric, finding: f });
  return { introduced, standing };
}
