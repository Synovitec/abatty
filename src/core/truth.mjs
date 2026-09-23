/**
 * Presence read against what is known to be true. A rule that finds a lint script is "present";
 * whether the lint can run here, and whether it has ever been seen to go red, are two other facts
 * the score used to ignore. An outside trial called it counting presence, not truth: a repository
 * with every script and none of the tools installed scored as well as one whose gate had been
 * proven. Two readings are already on disk and need nothing run: the prerequisites (is the step's
 * tool, config and lockfile here) and the last `doctor --controls` (did the step go red on a
 * planted violation). A present finding they contradict drops to partial and says why; one they
 * confirm is marked proven. The rest are present and unproven, and the summary says how many.
 */
import { readJsonFile } from "./repo.mjs";
import { CONTROLS_FILE, CONTROLS_VERSION } from "./step-controls.mjs";
import { prerequisites } from "./prereqs.mjs";

/**
 * @typedef {import("../rules/index.mjs").Finding} Finding
 * @typedef {{ proven: number, contradicted: number, unproven: number }} Truth
 */

/**
 * The rules whose "present" means a gate step exists, by the step's label before its parentheses.
 * Named rather than derived from the standard's codes, which are broader: TYPES-STRICT cites
 * CODE.3 and is about the compiler's flags, not about whether the typecheck runs.
 */
const STEP_RULES = /** @type {Record<string, string[]>} */ ({
  format: ["CODE-FORMAT"],
  lint: ["CODE-LINTER", "CODE-MAXWARN"],
  typecheck: ["TYPES-SCRIPT"],
  "import graph": ["CODE-ARCH-GRAPH"],
  "dead code": ["CODE-DEADCODE"],
  "unit tests": ["TEST-UNIT"],
  audit: ["SEC-AUDIT"],
  "secret scan": ["SEC-SECRETS"],
});

/** @param {string} label */
const stem = (label) => label.replace(/\s*\(.*$/, "").trim();

/** The major and minor of a version, as one comparable number. @param {unknown} v */
const minorOf = (v) => {
  const [major = 0, minor = 0] = String(v || "0.0")
    .split(".")
    .map(Number);
  return major * 1000 + minor;
};

/**
 * The last controls run, when this version of abatty can still read it as evidence: one written
 * by an older minor version, or by one that did not record its version, planted where that
 * version planted, and read as today's proof it once dropped three steps a monorepo had watched
 * fail by hand. Such a run is left unread, so the steps read unproven rather than contradicted.
 * @param {any} controls
 */
function current(controls) {
  return controls && minorOf(controls.abatty) >= minorOf(CONTROLS_VERSION) ? controls : null;
}

/**
 * Mark each present finding a gate step backs: proven, contradicted (and dropped to partial) or
 * left unproven. Returns new findings; the input is not changed.
 * @param {Finding[]} findings @param {string} repoDir
 * @param {import("../presets/index.mjs").Preset | null} preset
 * @returns {{ findings: Finding[], truth: Truth }}
 */
export function applyTruth(findings, repoDir, preset) {
  const truth = { proven: 0, contradicted: 0, unproven: 0 };
  if (!preset) return { findings, truth };
  /** @type {Map<string, string>} rule id → why it is not true here */
  const against = new Map();
  /** @type {Set<string>} */
  const proven = new Set();
  const controls = current(readJsonFile(repoDir, CONTROLS_FILE));
  const outcomes = new Map(
    (Array.isArray(controls?.steps) ? controls.steps : []).map((/** @type {any} */ s) => [
      stem(String(s.label)),
      String(s.outcome),
    ]),
  );
  // The container runtime is a fact of this machine, not of the repository: not asked.
  for (const p of prerequisites(repoDir, preset, { dockerUp: () => true })) {
    const rules = STEP_RULES[stem(p.label)] || [];
    const outcome = outcomes.get(stem(p.label));
    for (const id of rules)
      if (p.state === "missing") against.set(id, `its gate step cannot run here (${p.detail})`);
      else if (outcome === "green")
        against.set(id, "its gate step stayed green on a planted violation (doctor --controls)");
      else if (outcome === "red") proven.add(id);
  }
  const out = findings.map((f) => {
    if (f.status !== "present" || !Object.values(STEP_RULES).flat().includes(f.id)) return f;
    const why = against.get(f.id);
    if (why) {
      truth.contradicted++;
      return {
        ...f,
        status: /** @type {const} */ ("partial"),
        evidence: `${f.evidence}; but ${why}`,
      };
    }
    if (proven.has(f.id)) truth.proven++;
    else truth.unproven++;
    return f;
  });
  return { findings: out, truth };
}
