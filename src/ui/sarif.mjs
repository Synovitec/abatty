/**
 * SARIF 2.1.0, the interchange format the major forges ingest directly. A finding uploaded as
 * SARIF appears on the line it concerns, in the diff of the change that introduced it, which is
 * the one placement the evidence base found makes a difference: the same analysis at the same
 * precision reached a near-zero fix rate delivered as a report and above seventy per cent
 * delivered on the change under review.
 *
 * This is a renderer and nothing else: it reads findings that are already computed and writes
 * them in somebody else's shape. Nothing here decides whether something is a finding.
 */
import { createHash } from "node:crypto";

export const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
export const SARIF_VERSION = "2.1.0";

/**
 * What a rule's enforcement means to a forge. A rule a machine refuses is an error; one a human
 * is asked to look at is a warning; one that is only written down is a note. A ratchet metric is
 * an error when the number rose and a warning when it is merely above zero, because the promise
 * a ratchet makes is about the direction, not the value.
 * @param {string} enforcement @param {boolean} [rising]
 */
export const sarifLevel = (enforcement, rising = false) =>
  enforcement === "hard"
    ? "error"
    : enforcement === "ratchet"
      ? rising
        ? "error"
        : "warning"
      : enforcement === "review"
        ? "warning"
        : "note";

/**
 * The identity of a finding across runs, which is what `partialFingerprints` is for: line
 * numbers move when the file above them changes, and a finding that is re-reported as new every
 * time a line is inserted is a finding nobody can track. The ratchet solves the same problem by
 * hand with its per-file debt; this is the standard's answer to it.
 * @param {(string | number | undefined)[]} parts
 */
export const fingerprint = (parts) =>
  createHash("sha256")
    .update(parts.map((p) => (p === undefined ? "" : String(p))).join("\u0000"))
    .digest("hex")
    .slice(0, 16);

/**
 * @typedef {{ id: string, name?: string, shortDescription: { text: string }, fullDescription?: { text: string }, defaultConfiguration?: { level: string }, properties?: Record<string, unknown> }} SarifRule
 * @typedef {{ ruleId: string, level: string, message: { text: string }, locations?: unknown[], partialFingerprints?: Record<string, string>, properties?: Record<string, unknown> }} SarifResult
 */

/**
 * One SARIF log: the tool that produced it, the rules it knows, the results it found.
 * @param {{ version: string, rules: SarifRule[], results: SarifResult[], repoUri?: string }} o
 */
export function sarifLog(o) {
  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: "abatty",
            version: o.version,
            informationUri: "https://abatty.io",
            rules: o.rules,
          },
        },
        results: o.results,
      },
    ],
  };
}

/** A physical location, or nothing when the finding is about the repository rather than a line. @param {string} [path] @param {number} [line] */
const locationOf = (path, line) =>
  path
    ? [
        {
          physicalLocation: {
            artifactLocation: { uri: path, uriBaseId: "%SRCROOT%" },
            ...(line ? { region: { startLine: line } } : {}),
          },
        },
      ]
    : undefined;

/**
 * The gap analysis as SARIF. A catalog finding is about the repository rather than about a line,
 * so it carries no location and a forge shows it against the run; the ratchet's findings are the
 * ones that land on a diff.
 * @param {{ findings: import("../rules/index.mjs").Finding[], version: string }} o
 */
export function sarifOfFindings(o) {
  const open = o.findings.filter((f) => f.status === "missing" || f.status === "partial");
  /** @type {SarifRule[]} */
  const rules = [];
  const seen = new Set();
  for (const f of open) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    rules.push({
      id: f.id,
      name: f.rule,
      shortDescription: { text: f.rule },
      fullDescription: { text: f.next || f.rule },
      defaultConfiguration: { level: sarifLevel(f.enforcement) },
      properties: {
        family: f.family,
        phase: f.phase,
        level: f.level,
        enforcement: f.enforcement,
        standard: f.standard,
      },
    });
  }
  const results = open.map((f) => ({
    ruleId: f.id,
    level: sarifLevel(f.enforcement),
    message: { text: `${f.status}: ${f.evidence}${f.next ? ` · next: ${f.next}` : ""}` },
    partialFingerprints: { abattyFinding: fingerprint([f.id, f.status]) },
    properties: { status: f.status, phase: f.phase, enforcement: f.enforcement },
  }));
  return sarifLog({ version: o.version, rules, results });
}

/**
 * The ratchet as SARIF: every probe finding at the path and line it names, which is the shape a
 * forge puts on the diff of the change under review.
 * @param {{ verdicts: import("../ratchet/index.mjs").Verdict[], probes: import("../ratchet/index.mjs").Probe[], version: string }} o
 */
export function sarifOfVerdicts(o) {
  const byMetric = new Map(o.probes.map((p) => [p.metric, p]));
  /** @type {SarifRule[]} */
  const rules = [];
  /** @type {SarifResult[]} */
  const results = [];
  for (const v of o.verdicts) {
    if (!v.findings.length) continue;
    const probe = byMetric.get(v.metric);
    const rising = v.status === "regressed" || v.status === "hard-fail";
    rules.push({
      id: v.metric,
      shortDescription: { text: probe?.title || v.metric },
      fullDescription: { text: probe?.why || probe?.title || v.metric },
      defaultConfiguration: { level: sarifLevel(v.kind, rising) },
      properties: { kind: v.kind, standard: probe?.standard || [], axis: probe?.axis },
    });
    for (const f of v.findings)
      results.push({
        ruleId: v.metric,
        level: sarifLevel(v.kind, rising),
        message: {
          text: `${f.detail || v.metric}${v.floor === null ? "" : ` · floor ${v.floor}, now ${v.value}`}`,
        },
        locations: locationOf(f.path, f.line),
        partialFingerprints: { abattyFinding: fingerprint([v.metric, f.path, f.detail]) },
        properties: { kind: v.kind, status: v.status },
      });
  }
  return sarifLog({ version: o.version, rules, results });
}
