/**
 * The baseline: the committed floor, read back tolerant of a hand edit, and written by
 * `abatty baseline` under the rules of standard §2.2 - a zero is promoted to HARD, a HARD
 * metric above zero is refused, a number that rose is refused without a reason and an owner.
 *
 * Two things are recorded beside every number, because a floor is a promise and a promise with
 * nobody's name on it is a wish. `entries` holds, per metric, the day it was raised, who raised
 * it and why, and it survives the next write: a reason given once for one metric is not erased by
 * an unrelated rebaseline of another. `versions` holds the definition each floor was written
 * under, so a probe that changes what it counts is reported rather than silently compared against
 * a number that meant something else.
 */
import { readJsonFile, writeJsonFile } from "../core/repo.mjs";
import { BASELINE_NOTE } from "./config.mjs";
import { scoreOf } from "./index.mjs";

/**
 * @typedef {import("./index.mjs").Baseline} Baseline
 * @typedef {import("./index.mjs").Measurement} Measurement
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 * @typedef {import("./index.mjs").BaselineEntry} BaselineEntry
 */

/**
 * The definition a metric is counted under. A probe that changes WHAT it counts bumps this, and
 * the floor written under the old number is then reported rather than compared. 1 is the
 * definition a probe has until somebody says otherwise.
 * @param {{ probe: { version?: number } }} m
 */
export function probeVersion(m) {
  return typeof m.probe.version === "number" ? m.probe.version : 1;
}

/** The committed baseline, or null. @param {string} repoDir @param {string} rel @returns {Baseline | null} */
export function readBaseline(repoDir, rel) {
  try {
    const b = readJsonFile(repoDir, rel);
    return b && typeof b === "object" && b.metrics && typeof b.metrics === "object" ? b : null;
  } catch {
    return null;
  }
}

/**
 * Write today's numbers as the floor. A metric at zero is promoted to HARD (a floor of zero and
 * a HARD rule enforce the same thing today and differ in what they tell the next person) unless
 * the config holds it as a ratchet; a HARD metric above zero is refused; a number above the
 * committed floor is refused without a reason, and with one the reason belongs in the progress
 * log. Nothing is written when refused.
 * @param {{ repoDir: string, rel: string, measurements: Measurement[], config: RatchetConfig, previous: Baseline | null, today: string, reason?: string, owner?: string, dryRun?: boolean }} o
 * @returns {{ ok: boolean, baseline: Baseline, refusals: string[], promoted: string[], rises: string[] }}
 */
export function writeBaseline(o) {
  const { measurements, config, previous } = o;
  /** @type {string[]} */
  const refusals = [];
  /** @type {string[]} */
  const promoted = [];
  /** @type {string[]} */
  const rises = [];
  /** @type {{ metric: string, file: string, was: number, now: number }[]} */
  const fileRisen = [];
  const hard = new Set(previous?.hard || []);
  /** @type {Record<string, number>} */
  const metrics = {};
  /** @type {Record<string, number>} */
  const scanned = {};
  /** @type {Record<string, Record<string, number>>} */
  const debt = {};
  /** @type {Record<string, number>} */
  const versions = {};
  /** Kept from the previous write: an entry explains ITS metric, not the day it was written. */
  const entries = { .../** @type {Record<string, BaselineEntry>} */ (previous?.entries || {}) };
  for (const m of measurements) {
    if (m.skipped) continue;
    const forcedRatchet = config.ratchet.includes(m.metric);
    const isHard =
      config.hard.includes(m.metric) ||
      hard.has(m.metric) ||
      (m.probe.kind === "hard" && !forcedRatchet);
    if (isHard && m.value > 0) {
      refusals.push(
        `${m.metric} is HARD and reads ${m.value}; a HARD metric is never recorded above zero - fix the findings, or hold it as a ratchet through \`ratchet.ratchet\` in the adoption config with the reason in the decisions file`,
      );
      continue;
    }
    const was = previous?.metrics?.[m.metric];
    if (typeof was === "number" && m.value > was) rises.push(`${m.metric} ${was} → ${m.value}`);
    // Per file as well as in total: a total that fell carried ten files whose floors rose, with
    // nothing in the record, so a fall anywhere could hide a rise anywhere else.
    if (typeof was === "number")
      for (const [file, now, before] of fileRises(previous?.debt?.[m.metric], m.debt)) {
        rises.push(`${m.metric} ${file} ${before} → ${now}`);
        fileRisen.push({ metric: m.metric, file, was: before, now });
      }
    metrics[m.metric] = m.value;
    versions[m.metric] = probeVersion(m);
    if (!m.probe.emptyScanOk) scanned[m.metric] = m.scanned;
    if (m.value === 0 && !forcedRatchet) {
      if (!hard.has(m.metric) && m.probe.kind !== "hard") promoted.push(m.metric);
      hard.add(m.metric);
    } else {
      hard.delete(m.metric);
      if (m.value > 0) debt[m.metric] = Object.fromEntries(Object.entries(m.debt).sort());
    }
  }
  const missing = rises.length && (!o.reason || !o.owner);
  if (missing)
    refusals.push(
      `a floor never rises without a reason and an owner: ${rises.join(", ")}. Pass --reason "<why>" --owner "<who>" and write the same reason in docs/STANDARDS_PROGRESS.md, or fix the findings`,
    );
  for (const m of measurements) {
    if (m.skipped || !(m.metric in metrics)) continue;
    const was = previous?.metrics?.[m.metric];
    // The entry explains a number that is still there. Once the value falls back to or below the
    // floor it explained, the debt it was written for is gone and so is the entry: a reason left
    // behind outlives its subject and is read as cover for the next rise.
    if (typeof was === "number" && m.value > was && o.reason && o.owner)
      entries[m.metric] = { at: o.today, was, now: m.value, reason: o.reason, owner: o.owner };
    else if (entries[m.metric] && m.value <= (entries[m.metric]?.was ?? -1))
      delete entries[m.metric];
    // The same per file, under `metric file`: written with the rise, gone when that file's debt
    // falls back to the floor it explained.
    for (const [key, e] of Object.entries(entries))
      if (key.startsWith(`${m.metric} `) && (m.debt[key.slice(m.metric.length + 1)] ?? 0) <= e.was)
        delete entries[key];
  }
  if (o.reason && o.owner)
    for (const r of fileRisen)
      entries[`${r.metric} ${r.file}`] = {
        at: o.today,
        was: r.was,
        now: r.now,
        reason: o.reason,
        owner: o.owner,
      };
  const { score } = scoreOf(measurements);
  /** @type {Baseline} */
  const baseline = {
    ...(previous || {}),
    measuredAt: o.today,
    note: BASELINE_NOTE,
    score,
    hard: [...hard].sort(),
    metrics: Object.fromEntries(Object.entries(metrics).sort()),
    scanned: Object.fromEntries(Object.entries(scanned).sort()),
    debt: Object.fromEntries(Object.entries(debt).sort()),
    versions: Object.fromEntries(Object.entries(versions).sort()),
    entries: Object.fromEntries(Object.entries(entries).sort()),
  };
  // The one-per-write field this replaces. Left in place it would read as the reason for whatever
  // is in the file today, which is exactly the confusion `entries` exists to end.
  delete baseline.lastReason;
  const ok = refusals.length === 0;
  if (ok && !o.dryRun) writeJsonFile(o.repoDir, o.rel, baseline);
  return { ok, baseline, refusals, promoted, rises };
}

/**
 * The files whose debt rose against the previous floor, as [file, now, before]: a file new to the
 * debt counts from 0, because debt that moved into a file is a rise there whatever the total did.
 * @param {Record<string, number> | undefined} before @param {Record<string, number>} now
 * @returns {[string, number, number][]}
 */
function fileRises(before, now) {
  return Object.entries(now || {})
    .map(([file, n]) => /** @type {[string, number, number]} */ ([file, n, before?.[file] ?? 0]))
    .filter(([, n, b]) => n > b)
    .sort(([a], [b]) => a.localeCompare(b));
}
