/**
 * The baseline: the committed floor, read back tolerant of a hand edit, and written by
 * `abatty baseline` under the rules of standard §2.2 - a zero is promoted to HARD, a HARD
 * metric above zero is refused, a number that rose is refused without a reason.
 */
import { readJsonFile, writeJsonFile } from "../core/repo.mjs";
import { BASELINE_NOTE } from "./config.mjs";
import { scoreOf } from "./index.mjs";

/**
 * @typedef {import("./index.mjs").Baseline} Baseline
 * @typedef {import("./index.mjs").Measurement} Measurement
 * @typedef {import("./index.mjs").RatchetConfig} RatchetConfig
 */

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
 * @param {{ repoDir: string, rel: string, measurements: Measurement[], config: RatchetConfig, previous: Baseline | null, today: string, reason?: string, dryRun?: boolean }} o
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
  const hard = new Set(previous?.hard || []);
  /** @type {Record<string, number>} */
  const metrics = {};
  /** @type {Record<string, number>} */
  const scanned = {};
  /** @type {Record<string, Record<string, number>>} */
  const debt = {};
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
    metrics[m.metric] = m.value;
    if (!m.probe.emptyScanOk) scanned[m.metric] = m.scanned;
    if (m.value === 0 && !forcedRatchet) {
      if (!hard.has(m.metric) && m.probe.kind !== "hard") promoted.push(m.metric);
      hard.add(m.metric);
    } else {
      hard.delete(m.metric);
      if (m.value > 0) debt[m.metric] = Object.fromEntries(Object.entries(m.debt).sort());
    }
  }
  if (rises.length && !o.reason)
    refusals.push(
      `a floor never rises without a reason: ${rises.join(", ")}. Pass --reason "<why>" and write the same reason in docs/STANDARDS_PROGRESS.md, or fix the findings`,
    );
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
  };
  if (o.reason) baseline.lastReason = { at: o.today, reason: o.reason, rises };
  const ok = refusals.length === 0;
  if (ok && !o.dryRun) writeJsonFile(o.repoDir, o.rel, baseline);
  return { ok, baseline, refusals, promoted, rises };
}
