/**
 * The opt-in probes a repository has not enabled, each with what it would read here today. An
 * adopter's coverage exclude list grew for weeks beside a probe that counts it, off by default,
 * and nothing had told them it existed: doctor said nothing, and neither did the update. A probe
 * stays opt-in because it reads one stack's conventions; whether to run it is then a decision
 * the repository makes knowing the number, not one it makes by never hearing of the probe.
 */
import { BUILTIN_PROBES } from "../ratchet/index.mjs";
import { resolveConfig } from "../ratchet/config.mjs";
import { readAdoption } from "./repo.mjs";
import { buildContext } from "../rules/context.mjs";

/**
 * @typedef {{ metric: string, title: string, reads: number | null, why: string }} OffProbe
 *   `reads`: the findings it would count here, or null when it cannot read this way (a rule
 *   about a push, read without one) or failed to, with `why` saying which.
 */

/**
 * Every opt-in probe of this version the config neither enables nor excludes, with its reading.
 * @param {string} repoDir @returns {OffProbe[]}
 */
export function offProbes(repoDir) {
  const config = resolveConfig(readAdoption(repoDir));
  const enabled = new Set(Array.isArray(config.enable) ? config.enable : []);
  const off = BUILTIN_PROBES.filter(
    (p) => p.optIn && !enabled.has(p.metric) && !config.exclude.includes(p.metric),
  );
  if (!off.length) return [];
  const ctx = buildContext(repoDir, { tracked: true });
  return off.map((p) => readingOf(p, ctx, config));
}

/**
 * What one probe reads in a repository, the way the ratchet would record it: the sum of the
 * weights (a finding weighs one unless it says otherwise; counting findings read an exclude list
 * of nine as one), or null with the reason when the probe cannot read this way or failed to.
 * @param {import("../ratchet/index.mjs").Probe} p @param {import("../rules/context.mjs").RepoContext} ctx
 * @param {import("../ratchet/index.mjs").RatchetConfig} config @returns {OffProbe}
 */
export function readingOf(p, ctx, config) {
  try {
    const r = p.scan(ctx, { config, range: "" });
    if (r.skipped) return { metric: p.metric, title: p.title, reads: null, why: String(r.skipped) };
    const reads = r.findings.reduce((n, f) => n + (typeof f.weight === "number" ? f.weight : 1), 0);
    return { metric: p.metric, title: p.title, reads, why: "" };
  } catch (e) {
    return { metric: p.metric, title: p.title, reads: null, why: `could not read: ${String(e)}` };
  }
}
