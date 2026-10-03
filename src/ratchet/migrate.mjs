/**
 * The migration an update carries for a redefined probe. A probe whose definition changed reads its
 * old floor as `redefined`, and every adopter had to run `abatty baseline` by hand after the
 * update, which the release notes asked of them one step at a time. The floor under the old
 * definition answers another question, so writing the count under the new one is not a raise:
 * `update` does it, for those metrics and no other, and says so. A HARD metric that now counts
 * above zero is not written: that is a finding, and a person decides what it means.
 */
import { readAdoption, writeJsonFile } from "../core/repo.mjs";
import { pushRangeInfo } from "../core/range.mjs";
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
  // Over the push range, as `abatty baseline` measures: a probe that judges the pushed commits
  // read skipped with none, and its floor was carried under the new definition as a count of the
  // old one's question (Foodify, rc.3: 2 carried where the new definition read 0).
  // Only a range found and holding commits: an empty one (nothing pushed) counts zero of nothing,
  // and the last-commit guess with no upstream and no base counts one commit of many, and either
  // written as measured would claim a count nobody took. Without one the probe reads skipped and
  // its floor is carried, said to be.
  const pushed = pushRangeInfo(repoDir, String(readAdoption(repoDir)?.baseBranch || "main"));
  const range = pushed.how !== "unknown" && pushed.commits > 0 ? pushed.range : "";
  const measurements = measureAll(
    probes,
    buildContext(repoDir, { tracked: true }),
    { config, range },
    previous,
  );
  // A probe on probation reads `probation` whatever its verdict would be, and one that judges a
  // pushed range reads `skipped` with no range here, so neither floor under an old definition was
  // migrated: the gate, measuring the push, then read it redefined and refused (Foodify, rc.2,
  // change.testTamper). The version the floor was written under says it as well.
  const movedOn = (/** @type {string} */ metric) => {
    const m = measurements.find((x) => x.metric === metric);
    const wroteUnder = previous.versions?.[metric];
    return Boolean(m && wroteUnder !== undefined && wroteUnder !== probeVersion(m));
  };
  const redefined = compare(measurements, previous, config).filter(
    (v) =>
      v.status === "redefined" ||
      ((v.status === "probation" || v.status === "skipped") && movedOn(v.metric)),
  );
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
    // Nothing to count even over the push range (no commit to judge): the floor is carried
    // under the new definition as it stands, which is not a raise, and said to be carried; the
    // next gate measures the push and locks it.
    if (m.skipped) {
      next.versions = { ...(next.versions || {}), [v.metric]: version };
      out.push({
        metric: v.metric,
        was,
        now: was,
        version,
        written: true,
        why: "carried, not measured: no pushed commit to count; the next gate measures it",
      });
      continue;
    }
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
