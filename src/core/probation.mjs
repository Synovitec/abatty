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
 * @typedef {{ metric: string, runs: boolean, reads: number | null, disputes: number, clean: boolean }} ProbationReading
 *   `runs`: the repository runs it (not opt-in, or enabled). `clean`: it runs, reads 0 here and
 *   was never disputed here, which is one repository's vote for promotion.
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
    const reads = runs ? readingOf(p, ctx, config).reads : null;
    const n = Number(disputes[p.metric] || 0);
    return { metric: p.metric, runs, reads, disputes: n, clean: runs && reads === 0 && n === 0 };
  });
}
