/**
 * The instrument: the ratchet and its baseline, the per-file floors, the control cases, the
 * gate, the pre-commit hook, CI and its steps. Standard §2.2-2.4, P.1, P.2, SEC.1.
 */

/**
 * The package scripts a pipeline's text invokes (`npm run x`, `pnpm run x`, `yarn x`, `bun run
 * x`, with or without `-s`/`--silent`), and which of them the package does not have. A pipeline
 * is credited for what it can run, not for what it names: the generated one on a trial repository
 * named five scripts the package lacked, was red from its first run, and still counted as
 * "present" for six points of score. A comment line runs nothing, so it is not read: a pipeline
 * whose comment said "yarn 1 comes with the runner images" was charged with a script named `1`.
 * @param {string} ciText @param {Record<string, string>} scripts
 */
export function phantomScripts(ciText, scripts) {
  const named = new Set();
  const re =
    /\b(?:npm|pnpm|bun)\s+run\s+(?:-s\s+|--silent\s+)?([\w:.-]+)|\byarn\s+(?:run\s+)?(?:-s\s+)?([\w:.-]+)/g;
  const code = String(ciText)
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  for (const m of code.matchAll(re)) {
    const name = m[1] || m[2] || "";
    // `yarn install`, `yarn npm audit`: yarn's own verbs are not scripts.
    if (name && !/^(install|add|npm|exec|dlx|audit|cache|config|--\S*)$/.test(name))
      named.add(name);
  }
  return [...named].filter((n) => typeof scripts[n] !== "string");
}

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
    stages: ["build", "run"],
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
    stages: ["build", "run"],
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
    title: "Control cases both directions: for the probes, and for every gate step",
    standard: ["P.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    stages: ["build", "run"],
    why: "A probe that has never reported a planted violation may be reporting nothing, and a gate step that never went red may be checking nothing; a check with no failing control is not a check.",
    next: "Run the ratchet from the package (its probes carry their controls; `abatty ratchet --controls` runs them), then `abatty doctor --controls`: it plants a violation per gate step and reports a step that stays green as absent",
    check: (c) => {
      const t = c.firstFile(/standards-probe\.test\.|check-standards\.test\.|check-limits\.test\./);
      const packaged = c.script(/abatty(\.mjs"?)? ratchet/);
      const probes = t || (packaged ? "the package's probes, each with controls both ways" : "");
      if (!probes) return { status: "missing", evidence: "none" };
      // The gate steps: the last `doctor --controls` run, a step that stayed green is absent.
      const last = c.readJson(".abatty/controls.json");
      const absent = Array.isArray(last?.absent) ? last.absent.map(String) : [];
      const ran = Array.isArray(last?.steps)
        ? last.steps.filter((/** @type {any} */ s) => s.outcome === "red").length
        : 0;
      return {
        status: !last ? "partial" : absent.length ? "partial" : "present",
        evidence: `${probes}; gate steps: ${!last ? "controls not run yet (abatty doctor --controls)" : absent.length ? `${absent.join(", ")} stayed green on a planted violation (absent)` : `${ran} step(s) went red on a planted violation (${String(last.at).slice(0, 10)})`}`,
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
    stages: ["build", "run"],
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
    why: "The hook runs on the machine that pushes and can be skipped there; CI re-runs every gate independently of who pushed and of what they skipped. A pipeline is credited for the scripts it can run, not for the words it names: one that names a script the package lacks is red or never ran, and a comment runs nothing.",
    next: "abatty ci generates the pipeline from the gate (Woodpecker, GitHub Actions)",
    check: (c) => {
      if (!c.ciFiles.length)
        return {
          status: "missing",
          evidence:
            "no CI pipeline found (the providers the package reads: Woodpecker, GitHub Actions)",
        };
      // A pipeline that names a script the package does not have is a pipeline that is red, or
      // one that was never run; either way it is not the gate re-run on another machine.
      const phantom = phantomScripts(c.ciText, c.scripts);
      return {
        status: phantom.length ? "partial" : "present",
        evidence: `${c.ciFiles.join(", ")}${phantom.length ? `; names script(s) package.json does not have: ${phantom.join(", ")}` : ""}`,
        next: phantom.length
          ? "Add the scripts the pipeline names, or regenerate it from the scripts that exist (abatty ci)"
          : undefined,
      };
    },
  },
  {
    id: "INST-CI-STEPS",
    family: "Instrument",
    title: "CI runs lint, typecheck, tests, standards, secret scan, audit",
    standard: ["CODE.4", "CODE.3", "TEST.1", "P.2", "SEC.1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    stages: ["build", "run"],
    why: "A CI that runs the tests but not the ratchet lets the numbers rise unseen; the six steps are the gate, no less. A step whose script the package does not have is named, not counted, and a comment that names a step is not a step.",
    next: "Add the missing steps; a secret scan and an audit are one step each",
    check: (c) => {
      // A step is read for the word AND for the script behind it: `npm run -s lint` in a pipeline
      // whose package has no `lint` script is a red step, not a lint step.
      const phantom = new Set(phantomScripts(c.ciText, c.scripts));
      // Commands, not comments: a generated pipeline writes the step it could not emit as a
      // comment that names it, and a word in a comment is not a step that runs.
      const text = c.ciText.replace(/^\s*#.*$/gm, "");
      const steps = [
        "lint",
        "typecheck|type-check",
        "test",
        "standards|check-limits|invariants",
        "gitleaks|scan-secrets|secret-scan|secretlint|trufflehog|abatty secrets",
        "audit",
      ].map((re) => {
        const named = new RegExp(re, "i").test(text);
        const runnable = named && !re.split("|").some((n) => phantom.has(n));
        return [re, runnable, named && !runnable];
      });
      return {
        status:
          c.ciFiles.length === 0 ? "missing" : steps.every(([, ok]) => ok) ? "present" : "partial",
        evidence: steps
          .map(
            ([re, ok, ghost]) =>
              `${ok ? "ok" : ghost ? "NAMED, no script" : "MISSING"} ${String(re).split("|")[0]}`,
          )
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
    stages: ["build", "run"],
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
