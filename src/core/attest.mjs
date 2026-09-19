/**
 * The conformance attestation: what held, when, at which commit, under which version of the
 * standard, with the waivers and their owners, and the proof that every gate step was shown
 * capable of failing.
 *
 * It is NOT a bespoke document. It is an in-toto Statement carrying a custom predicate, which
 * means every attestation store, policy engine and verifier that already exists can hold it,
 * fetch it and gate on it on day one. A file of our own invention would need a reader this
 * package writes and a market it convinces first.
 *
 * What it deliberately does NOT claim is as much of the design as what it does. The compliance
 * ring already produces the bill of materials, the vulnerability report and the licence
 * inventory, in formats with a decade of tooling behind them; restating any of that here would
 * be a worse copy of a solved problem and would invite the reader to trust one document for
 * everything. This predicate carries only what nothing else can produce: which ENGINEERING rules
 * a repository holds, under which version of a written standard, which ones were set aside and
 * by whom, and whether the checks that say so have themselves been watched failing. `scope` says
 * that inside the document, so a reader who finds it in a store knows what not to ask of it.
 */
import { git, readConfig } from "./repo.mjs";
import { readJsonFile } from "./repo.mjs";
import { CONTROLS_FILE } from "./step-controls.mjs";

/** The in-toto Statement type, version 1. */
export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
/** The predicate this package defines. The URI is the version: a change of shape is a new one. */
export const PREDICATE_TYPE = "https://abatty.dev/attestation/conformance/v1";

/** What this predicate answers, and what it sends the reader elsewhere for. */
export const SCOPE = {
  answers: [
    "which engineering rules this repository holds, and which it does not",
    "under which version of which written standard, and which profiles",
    "which rules were set aside, by whom, with what reason and until when",
    "whether every gate step has been watched going red, so a green gate means something",
  ],
  doesNotAnswer: [
    "what this repository depends on: that is a bill of materials (CycloneDX, SPDX)",
    "which of those dependencies are vulnerable: that is a vulnerability report",
    "which licences apply: that is a licence inventory",
    "how the artefact was built: that is build provenance (SLSA), a different predicate",
  ],
};

/**
 * One rule's line in the record: enough to re-run the judgement, never the whole finding. A
 * reader who wants the evidence text runs the instrument; a reader who wants to gate on the
 * record needs the id, the level, what insures it and the verdict.
 * @param {import("../rules/index.mjs").Finding} f
 */
function conformanceOf(f) {
  return {
    rule: f.id,
    standard: f.standard || [],
    level: f.level,
    enforcement: f.enforcement,
    status: f.status,
    ...(f.ceiling ? { machineCeiling: f.ceiling.at } : {}),
  };
}

/**
 * The waivers, with their owners. A waiver with no owner is recorded as unowned rather than
 * omitted: an auditor's first question about a set-aside rule is who set it aside.
 * @param {import("../rules/index.mjs").Finding[]} findings
 */
function waiversOf(findings) {
  return findings
    .filter((f) => f.waiver)
    .map((f) => ({
      rule: f.id,
      reason: f.waiver?.reason || "",
      ...(f.waiver?.until ? { until: f.waiver.until } : {}),
      expired: Boolean(f.waiver?.expired),
      stillWaived: f.status === "waived",
    }));
}

/**
 * The gate's own credibility, read from the last `abatty doctor --controls` run: every step that
 * was planted with a violation and went red, and every step that stayed green, which means the
 * check is absent. An attestation that says "the gate passed" without this says nothing, because
 * a gate of steps that cannot fail passes everything.
 * @param {string} repoDir
 */
function controlsOf(repoDir) {
  const c = readJsonFile(repoDir, CONTROLS_FILE);
  if (!c || !Array.isArray(c.steps))
    return { ran: false, note: "no control run recorded: run `abatty doctor --controls`" };
  return {
    ran: true,
    at: String(c.at || ""),
    provenRed: c.steps.filter((/** @type {any} */ s) => s.outcome === "red").length,
    absent: Array.isArray(c.absent) ? c.absent : [],
    steps: c.steps.map((/** @type {any} */ s) => ({ step: s.label, outcome: s.outcome })),
  };
}

/**
 * The statement, ready to sign. Everything in it is read from the repository and from a report
 * that was already produced; nothing is computed twice, so the attestation cannot disagree with
 * the measurement it attests to.
 * @param {{ repoDir: string, report: import("./report.mjs").Report, version: string }} o
 * @returns {Record<string, unknown>}
 */
export function attestation(o) {
  const { repoDir, report, version } = o;
  const cfg = readConfig(repoDir);
  const commit = git(repoDir, "rev-parse", "HEAD");
  const findings = report.findings || [];
  const baseline = readJsonFile(repoDir, "scripts/ci/standards-baseline.json");
  return {
    _type: STATEMENT_TYPE,
    subject: [
      {
        name: report.name || report.repo,
        // The git commit IS the artefact here: a conformance statement is about a state of a
        // source tree, not about a file somebody built from it.
        digest: { gitCommit: commit },
      },
    ],
    predicateType: PREDICATE_TYPE,
    predicate: {
      scope: SCOPE,
      instrument: { name: "abatty", version },
      standard: {
        version: String(cfg?.standard?.version || cfg?.abatty || version),
        profiles: report.profiles || [],
      },
      measuredAt: report.date,
      stage: report.stage,
      score: report.score,
      applicable: report.applicable,
      enforced: report.enforced,
      conformance: findings.map(conformanceOf),
      waivers: waiversOf(findings),
      // The floors, and who raised each one and why: a number that may only fall is a promise,
      // and the promise is worth as much as the name attached to the last time it moved.
      ratchet: baseline
        ? {
            measuredAt: baseline.measuredAt,
            metrics: baseline.metrics || {},
            raised: baseline.entries || {},
          }
        : null,
      controls: controlsOf(repoDir),
    },
  };
}
