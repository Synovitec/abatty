/**
 * The instrument: the ratchet and its baseline, the per-file floors, the control cases, the
 * gate, the pre-commit hook, CI and its steps. Standard §2.2-2.4, P.1, P.2, SEC.1.
 */

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "INST-RATCHET",
    family: "Instrument",
    title: "A standards ratchet script with a committed baseline",
    standard: ["P.2"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A rule with a number is enforced the day the number is committed: existing debt is allowed, a new violation is refused, and a number that must go up is a decision written in the same commit.",
    next: "Add `standards: abatty ratchet` (init writes it) and run `abatty baseline` to record the floor",
    check: (c) => {
      const std = c.script(/^standards$|check-standards|check-limits|abatty ratchet/);
      const baseline = c.firstFile(/standards-baseline\.json$/);
      return {
        status: std && baseline ? "present" : std || baseline ? "partial" : "missing",
        evidence: `${std ? "script `" + std[0] + "`" : "no standards script"}; ${baseline || "no baseline file"}`,
      };
    },
  },
  {
    id: "INST-DEBT",
    family: "Instrument",
    title: "Per-file floors (debt) beside the totals",
    standard: ["P.2"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A total can hide a relocation: one file cleaned, another made worse, the sum unchanged. The floor per file refuses the new violation wherever it lands.",
    next: "Record debt per file so a total cannot hide a relocation",
    check: (c) => {
      const baseline = c.firstFile(/standards-baseline\.json$/);
      const json = baseline ? c.readJson(baseline) : null;
      return {
        status: json ? (json.debt ? "present" : "partial") : "missing",
        evidence: json
          ? json.debt
            ? `${Object.keys(json.debt).length} metric(s) with per-file debt`
            : "totals only"
          : "no baseline",
      };
    },
  },
  {
    id: "INST-CONTROLS",
    family: "Instrument",
    title: "Control cases for the probes, both directions",
    standard: ["P.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A probe that has never reported a planted violation may be reporting nothing; a probe with no failing control case is not added.",
    next: "Run the ratchet from the package (its probes carry their controls; `abatty ratchet --controls` runs them), or add a standards-probe.test file with a violation, a clean case and each regression",
    check: (c) => {
      const t = c.firstFile(/standards-probe\.test\.|check-standards\.test\.|check-limits\.test\./);
      const packaged = c.script(/abatty ratchet/);
      return {
        status: t || packaged ? "present" : "missing",
        evidence: t || (packaged ? "the package's probes, each with controls both ways" : "none"),
      };
    },
  },
  {
    id: "INST-GATE",
    family: "Instrument",
    title: "One gate script called by the pre-push hook and by npm",
    standard: ["FLOW.2"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "One command that says green or red is what a hook, a CI step, an agent's stop and a human all run; two lists of checks drift apart.",
    next: "Add a gate.mjs under scripts/ci and a .githooks/pre-push calling it (npm run hooks:install)",
    check: (c) => {
      const gate = c.script(/^gate$|^gate:fast$|scripts\/ci\/gate/);
      const hook = c.firstFile(
        /^\.githooks\/pre-push$|^\.husky\/pre-push$|^lefthook\.ya?ml$|^scripts\/hooks\/pre-push/,
      );
      const hooksPath = c.git("config", "core.hooksPath");
      return {
        status: gate && hook ? "present" : gate || hook ? "partial" : "missing",
        evidence: `${gate ? "`" + gate[0] + "`" : "no gate script"}; ${hook || "no pre-push hook"}${hooksPath ? "; core.hooksPath=" + hooksPath : ""}`,
      };
    },
  },
  {
    id: "INST-PRECOMMIT",
    family: "Instrument",
    title: "Pre-commit hook: console.log, secrets, locale set",
    standard: ["SEC.1", "I18N.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "The cheapest moment to refuse a secret or a stray console.log is before it is in a commit; after that it is in the history.",
    next: "Add a staged-files pre-commit hook sharing the secret scanner with CI",
    check: (c) => {
      const p = c.firstFile(
        /^\.githooks\/pre-commit$|^\.husky\/pre-commit$|^scripts\/hooks\/pre-commit/,
      );
      return { status: p ? "present" : "missing", evidence: p || "none" };
    },
  },
  {
    id: "INST-CI",
    family: "Instrument",
    title: "CI with the same gates",
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "The hook runs on the machine that pushes and can be skipped there; CI re-runs every gate independently of who pushed and of what they skipped.",
    next: "abatty ci generates the pipeline from the gate (Woodpecker, GitHub Actions)",
    check: (c) => ({
      status: c.ciFiles.length > 0 ? "present" : "missing",
      evidence:
        c.ciFiles.join(", ") ||
        "no CI pipeline found (the providers the package reads: Woodpecker, GitHub Actions)",
    }),
  },
  {
    id: "INST-CI-STEPS",
    family: "Instrument",
    title: "CI runs lint, typecheck, tests, standards, secret scan, audit",
    standard: ["CODE.4", "CODE.3", "TEST.1", "P.2", "SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "A CI that runs the tests but not the ratchet lets the numbers rise unseen; the six steps are the gate, no less.",
    next: "Add the missing steps; a secret scan and an audit are one step each",
    check: (c) => {
      const steps = [
        "lint",
        "typecheck|type-check",
        "test",
        "standards|check-limits|invariants",
        "gitleaks|scan-secrets|secret-scan|secretlint|trufflehog|abatty secrets",
        "audit",
      ].map((re) => [re, new RegExp(re, "i").test(c.ciText)]);
      return {
        status:
          c.ciFiles.length === 0 ? "missing" : steps.every(([, ok]) => ok) ? "present" : "partial",
        evidence: steps
          .map(([re, ok]) => `${ok ? "ok" : "MISSING"} ${String(re).split("|")[0]}`)
          .join(", "),
      };
    },
  },
  {
    id: "INST-DEAD-CI",
    family: "Instrument",
    title: "No dead CI workflow posting meaningless red checks",
    level: "should",
    enforcement: "prose",
    phase: "0",
    why: "A red check nobody reads teaches everyone to ignore red checks.",
    next: "Reduce GitHub workflows to workflow_dispatch or delete them",
    check: (c) => ({
      status: c.ghWorkflows.length === 0 ? "present" : c.ciFiles.length > 0 ? "partial" : "n/a",
      evidence: c.ghWorkflows.length
        ? `${c.ghWorkflows.length} GitHub workflow(s) beside Woodpecker`
        : "none",
    }),
  },
];
