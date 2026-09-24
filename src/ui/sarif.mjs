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

/** The schema a SARIF log names, so a forge and a validator read it as the version it is. */
export const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
/** The one SARIF version emitted: the one code-scanning services accept. */
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
  const results = open.map((f) => {
    // Rendered from the finding's own `where`, never derived here: this file renders what it is
    // given, which is the boundary the import graph enforces. Without it, this renderer and the
    // MCP surface disagreed about whether a finding's location was knowable.
    const at = f.where;
    return {
      ruleId: f.id,
      level: sarifLevel(f.enforcement),
      message: { text: `${f.status}: ${f.evidence}${f.next ? ` · next: ${f.next}` : ""}` },
      ...(at ? { locations: locationOf(at.path, at.line) } : {}),
      partialFingerprints: { abattyFinding: fingerprint([f.id, f.status]) },
      properties: { status: f.status, phase: f.phase, enforcement: f.enforcement },
    };
  });
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
    // A probe on probation fails nothing, so it is never an error a forge fails a check on.
    const level = v.status === "probation" ? "note" : sarifLevel(v.kind, rising);
    rules.push({
      id: v.metric,
      shortDescription: { text: probe?.title || v.metric },
      fullDescription: { text: probe?.why || probe?.title || v.metric },
      defaultConfiguration: { level },
      properties: { kind: v.kind, standard: probe?.standard || [], axis: probe?.axis },
    });
    // The ordinal of this finding among the ones this metric reports for this file. A probe that
    // reports per occurrence produces several findings sharing a metric, a path and a detail, and
    // without a discriminator they collide into one and a forge shows a single alert for three
    // problems. The ordinal rather than the LINE on purpose: the point of a partial fingerprint
    // is to survive an unrelated line being inserted above, and a line number does not.
    /** @type {Map<string, number>} */
    const seen = new Map();
    for (const f of v.findings) {
      const key = `${v.metric}\u0000${f.path}`;
      const nth = (seen.get(key) || 0) + 1;
      seen.set(key, nth);
      results.push({
        ruleId: v.metric,
        level,
        message: {
          text: `${f.detail || v.metric}${v.floor === null ? "" : ` · floor ${v.floor}, now ${v.value}`}`,
        },
        locations: locationOf(f.path, f.line),
        partialFingerprints: { abattyFinding: fingerprint([v.metric, f.path, f.detail, nth]) },
        properties: { kind: v.kind, status: v.status },
      });
    }
  }
  return sarifLog({ version: o.version, rules, results });
}
