/**
 * What to fix before anything else, put at the top of a reading. An adopter's first report led
 * with documents, context sections and decision records while the worst it had to fix was two
 * critical advisories and an unvalidated server action. A reading stays a reading of the tree,
 * offline: the secret scan runs (it is local and fast), the audit is the last gate's, read from
 * its step log with its date, or named as not yet run, and the must-level Security rules still
 * missing follow. Each line says how old what it reports is.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { scanSecrets } from "./secrets.mjs";
import { stepLogPath } from "./spawn.mjs";
import { localToday } from "./today.mjs";
import { ciGate } from "../ci/day-one.mjs";

/** The gate's audit step, as every preset labels it. */
const AUDIT_STEP = "audit (SEC.1)";

/**
 * The lines of the "fix these first" block, most urgent first; empty when nothing is urgent.
 * @param {string} repoDir @param {import("../rules/index.mjs").Finding[]} findings the reading's
 * @returns {string[]}
 */
export function fixFirst(repoDir, findings) {
  /** @type {string[]} */
  const lines = [];
  const secrets = scanSecrets(repoDir, { mode: "tree" }).findings;
  if (secrets.length)
    lines.push(
      `${secrets.length} secret(s) in the tree, now: ${secrets
        .slice(0, 3)
        .map((f) => `${f.path}:${f.line} (${f.kind})`)
        .join(", ")}${secrets.length > 3 ? ", …" : ""}`,
    );
  lines.push(...auditLines(repoDir));
  const security = findings.filter(
    (f) => f.family === "Security" && f.level === "must" && f.status === "missing",
  );
  for (const f of security.slice(0, 3)) lines.push(`${f.id} missing: ${f.next}`);
  return lines;
}

/** The last gate's audit, as its step log left it: failed with its advisories, could not run, or not run. @param {string} repoDir */
function auditLines(repoDir) {
  const log = stepLogPath(repoDir, AUDIT_STEP);
  // Not run here is urgent only where nothing else runs it: CI that runs the gate does. And only
  // where the gate has an audit to run: a repository with no package.json is on a preset without
  // one, and a design repository was told first thing to fix an audit nothing could run.
  if (!existsSync(log))
    return !existsSync(join(repoDir, "package.json")) ||
      ["gate", "fast"].includes(ciGate(repoDir).state)
      ? []
      : ["the audit has not run here: the gate runs it (and CI, once a pipeline runs the gate)"];
  const text = readFileSync(log, "utf8").trim();
  const day = localToday(statSync(log).mtime);
  const verdict = text.split("\n").pop() || "";
  // A red audit read as nothing to fix when the instrument, not the work, stopped it.
  if (/^errored/.test(verdict) || /✗ .*could not run/.test(text))
    return [
      `the audit could not run at the last gate (${day}): ${verdict.replace(/^errored:?\s*/, "") || "see .abatty/steps/audit_SEC.1_.log"}`,
    ];
  if (!/^failed/.test(verdict) && !/✗ .*failed/.test(text)) return [];
  const advisories = text
    .split("\n")
    .filter((l) => /\((?:critical|high|moderate|low)\)/.test(l))
    .slice(0, 3);
  return [
    `the audit failed at the last gate (${day}): ${advisories.length ? advisories.join("; ") : "see .abatty/steps/audit_SEC.1_.log"}`,
  ];
}
