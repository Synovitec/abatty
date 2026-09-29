/**
 * A rule that a probe also holds reads the probe's own count. The catalog and the ratchet counted
 * the same practice with two implementations: TYPES-ESCAPES counted an `any` in a comment of a
 * JavaScript file that `types.escapes` rightly skipped, and VALID-ENV took whichever file was
 * named env as the module while `valid.rawEnv` honoured the configured one and the exempt list.
 * An adopter was shown two numbers for one question. One scan, two readers.
 */
import { probes } from "../ratchet/probes/code.mjs";
import { resolveConfig } from "../ratchet/config.mjs";

/**
 * The findings of one of the code probes over the repository, with the ratchet's configuration
 * (its exempt list, its env module) resolved from the repository's own.
 * @param {import("./context.mjs").RepoContext} c @param {string} metric
 * @returns {{ findings: { path: string, line?: number, detail?: string }[], config: import("../ratchet/index.mjs").RatchetConfig }}
 */
export function probeFindings(c, metric) {
  const probe = probes.find((p) => p.metric === metric);
  if (!probe) throw new Error(`no code probe ${metric}`);
  const config = resolveConfig(c.adoption);
  const r = probe.scan(c, { config, range: "" });
  return { findings: r.skipped ? [] : r.findings, config };
}
