/**
 * The checks on probation, each with what it reads in this repository and how often it was
 * disputed here: the evidence a check leaves probation on. A probe is shown and never fails while
 * on probation, until a named repository has run it clean; that decision was taken by hand for
 * each one, and none had been taken. A report carries the reading, the package collects the
 * reports its adopters send, and a check that reads clean across them with no dispute is ready.
 */
import { BUILTIN_PROBES } from "../ratchet/index.mjs";
import { resolveConfig } from "../ratchet/config.mjs";
import { readAdoption } from "./repo.mjs";
import { buildContext } from "../rules/context.mjs";
import { readingOf } from "./opt-in.mjs";

/**
 * @typedef {{ metric: string, runs: boolean, reads: number | null, scanned: number, why: string, disputes: number, clean: boolean }} ProbationReading
 *   `runs`: the repository runs it (not opt-in, or enabled). `clean`: it runs, scanned something,
 *   reads 0 and was never disputed here, which is one repository's vote for promotion; a check
 *   with nothing of its kind to read (no documents for a documents check) casts none.
 */

/**
 * Every probe on probation, with its reading here and the disputes recorded against it.
 * @param {string} repoDir @param {Record<string, number>} disputes by metric, from the report
 * @returns {ProbationReading[]}
 */
export function probationReadings(repoDir, disputes) {
  const config = resolveConfig(readAdoption(repoDir));
  const enabled = new Set(Array.isArray(config.enable) ? config.enable : []);
  const on = BUILTIN_PROBES.filter((p) => p.probation && !config.exclude.includes(p.metric));
  if (!on.length) return [];
  const ctx = buildContext(repoDir, { tracked: true });
  return on.map((p) => {
    const runs = !p.optIn || enabled.has(p.metric);
    const r = runs ? readingOf(p, ctx, config) : null;
    const n = Number(disputes[p.metric] || 0);
    const reads = r ? r.reads : null;
    const scanned = r ? r.scanned : 0;
    const clean = runs && reads === 0 && scanned > 0 && n === 0;
    return { metric: p.metric, runs, reads, scanned, why: r?.why || "", disputes: n, clean };
  });
}
