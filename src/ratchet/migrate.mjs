/**
 * The migration an update carries for a redefined probe. A probe whose definition changed reads its
 * old floor as `redefined`, and every adopter had to run `abatty baseline` by hand after the
 * update, which the release notes asked of them one step at a time. The floor under the old
 * definition answers another question, so writing the count under the new one is not a raise:
 * `update` does it, for those metrics and no other, and says so. A HARD metric that now counts
 * above zero is not written: that is a finding, and a person decides what it means.
 */
import { writeJsonFile } from "../core/repo.mjs";
import { buildContext } from "../rules/context.mjs";
import { readBaseline, probeVersion } from "./baseline.mjs";
import { compare, loadProbes, measureAll, ratchetSetup } from "./index.mjs";

/**
 * @typedef {{ metric: string, was: number, now: number, version: number, written: boolean, why: string }} Migrated
 */

/**
 * Rewrite the floors the baseline holds under an older definition of their probe.
 * @param {string} repoDir @param {{ dryRun?: boolean }} [o]
 * @returns {Promise<Migrated[]>}
 */
export async function migrateRedefined(repoDir, o = {}) {
  const { config, baselineRel } = ratchetSetup(repoDir);
  const previous = readBaseline(repoDir, baselineRel);
  if (!previous) return [];
  const { probes } = await loadProbes(repoDir, config);
  const measurements = measureAll(
    probes,
    buildContext(repoDir, { tracked: true }),
    { config, range: "" },
    previous,
  );
  const redefined = compare(measurements, previous, config).filter((v) => v.status === "redefined");
  if (!redefined.length) return [];
  const next = JSON.parse(JSON.stringify(previous));
  const hard = new Set(previous.hard || []);
  // HARD as `abatty baseline` reads it: the baseline's list, the config's, or a hard probe the
  // config does not hold as a ratchet. A probe on probation is never HARD.
  const isHard = (/** @type {import("./index.mjs").Measurement} */ m) =>
    !m.probe.probation &&
    (hard.has(m.metric) ||
      config.hard.includes(m.metric) ||
      (m.probe.kind === "hard" && !config.ratchet.includes(m.metric)));
  /** @type {Migrated[]} */
  const out = [];
  for (const v of redefined) {
    const m = measurements.find((x) => x.metric === v.metric);
    if (!m) continue;
    const was = Number(previous.metrics?.[v.metric] ?? 0);
    const version = probeVersion(m);
    if (isHard(m) && m.value > 0) {
      out.push({
        metric: v.metric,
        was,
        now: m.value,
        version,
        written: false,
        why: "HARD and above zero: fix the findings, or decide by hand",
      });
      continue;
    }
    next.metrics[v.metric] = m.value;
    next.versions = { ...(next.versions || {}), [v.metric]: version };
    if (!m.probe.emptyScanOk) next.scanned = { ...(next.scanned || {}), [v.metric]: m.scanned };
    if (m.value > 0)
      next.debt = {
        ...(next.debt || {}),
        [v.metric]: Object.fromEntries(Object.entries(m.debt).sort()),
      };
    else if (next.debt) delete next.debt[v.metric];
    out.push({ metric: v.metric, was, now: m.value, version, written: true, why: "" });
  }
  if (!o.dryRun && out.some((x) => x.written)) writeJsonFile(repoDir, baselineRel, next);
  return out;
}
