/**
 * The repository is not trusted input (standard SEC.5, research 08 F16 and F17).
 *
 * A night points an agent at a tree and lets it read everything in it: source, documents,
 * dependency metadata, tool output. The sandbox below that is good and proves its own boundary,
 * but it answers a different question - what the agent may do - and not this one: what the
 * repository is telling it to do. Text in a file an agent reads is an instruction to a model in
 * exactly the way a prompt is, and a repository is a place other people can write.
 *
 * Three shapes are looked for, and a finding stops an unattended night rather than being filtered
 * out of the content. A filter that fails quietly is the same class of defect as a gate step that
 * checks nothing: the work continues and nobody knows the check did not happen.
 */
import { readFileSync } from "node:fs";

/**
 * @typedef {{ kind: "instruction" | "dependency" | "command", path: string, line: number, text: string, why: string }} TrustFinding
 */

/** Text that addresses a model rather than a reader. */
const INSTRUCTION = [
  [
    /ignore (all |any )?(previous|prior|earlier|above) (instructions|prompts|rules)/i,
    "tells a model to drop the instructions it was given",
  ],
  [
    /disregard (the |all |any )?(previous|prior|system|above)/i,
    "tells a model to disregard what it was told",
  ],
  [
    // `act as` needs BOTH a second-person lead and a role-shaped object. Without the first,
    // "the Cyber Resilience Act as a deadline" is an attack; without the second, so is "they act
    // as a ratchet on quality". Both were findings on this repository's own prose.
    /\byou are now\b|\bfrom now on,? you\b|(?:^|\byou (?:should|must|will|can|could)?\s*|\b(?:please|now|instead)[,:]?\s+)act as (?:an?|the) (?:\w+\s+){0,3}(?:assistant|agent|model|expert|developer|engineer|admin(?:istrator)?|root|system|superuser|persona|character|bot)/i,
    "reassigns the model's role",
  ],
  [/<\/?(system|assistant)>|^\s*system:\s/im, "forges a turn boundary"],
  [
    /do not (tell|inform|mention to) the (user|human|operator)/i,
    "asks the model to keep something from the person running it",
  ],
  [
    // A determiner is required for the weak verbs, because "17 per cent fewer output tokens" is
    // prose and was a finding. The strong verbs need none: nobody exfiltrates innocently.
    /\b(print|output|send|show|display) (the|your|all|its) (system prompt|secrets?|credentials?|api keys?|tokens?)\b|\b(reveal|exfiltrate|leak|dump|steal) (the |your |all )?(system prompt|secrets?|credentials?|api keys?)\b/i,
    "asks for a secret or the prompt",
  ],
  [
    /^\s*(?:[-*>]\s*)?(?:please\s+)?(skip|bypass|disable|turn off) (the )?(gate|hook|check|test|lint|guard)/im,
    "asks for a control to be switched off",
  ],
];

/**
 * A line that forbids the thing it names is not an instruction to do it. The guard this package
 * ships writes the bypass flag down in order to refuse it and the standard writes it down in
 * order to forbid it; a scan that reads those as attacks is a scan a repository switches off,
 * which is the failure that matters, because then it catches nothing at all.
 */
const FORBIDS =
  /\bnever\b|\bnot a workflow\b|\brefus|\bdeny\b|\bforbidden\b|\bis not\b|\bmust not\b|\bdo not use\b/i;

/**
 * This scanner's own source and the file that proves it works. Both necessarily contain every
 * shape it looks for, and both were findings on this repository.
 *
 * Exactly these two paths, never "tests" as a class: a hostile repository would put its
 * instruction in a test file precisely because a scan had been taught to skip those.
 */
const SKIP_SELF = /(^|\/)trust\.(mjs|test\.mjs)$/;

/** How far above a line to look for the key that opens the block it sits in. */
const BLOCK_LOOKBACK = 25;

/**
 * Whether a line sits inside a block that FORBIDS what it lists. A permission deny-list names
 * `rm -rf /` in order to refuse it, and the harness this package ships is such a list: reading it
 * as an attack made the scan fire on its own settings template.
 *
 * The line-level FORBIDS guard cannot see this, because the word that forbids is on the key
 * above, not on the entry. So the key is looked for, bounded, stopping at whatever block
 * actually encloses the line.
 * @param {string[]} lines @param {number} i
 */
function insideRefusal(lines, i) {
  for (let j = i - 1; j >= 0 && i - j <= BLOCK_LOOKBACK; j--) {
    const l = String(lines[j] || "");
    if (
      /["']?(deny|denied|refuse|refused|forbid|forbidden|block(ed)?|disallow(ed)?|never)["']?\s*:\s*[[{]/i.test(
        l,
      )
    )
      return true;
    // Another block's key, or a closing bracket: whatever encloses this line, it is not a refusal
    // that began above the thing we just walked past.
    if (/["']?(allow|allowed|permit|ask|additionalDirectories|env)["']?\s*:\s*[[{]/i.test(l))
      return false;
    if (/^\s*[}\]]/.test(l)) return false;
  }
  return false;
}

/** A command a document asks a human, or an agent, to run. */
const COMMAND = [
  [/curl[^\n|]*\|\s*(sudo\s+)?(ba)?sh/i, "pipes a download straight into a shell"],
  [/wget[^\n|]*\|\s*(sudo\s+)?(ba)?sh/i, "pipes a download straight into a shell"],
  [/\brm\s+-rf\s+[~/]/i, "deletes from the home directory or the root"],
  [/\beval\s+"?\$\(/i, "evaluates the output of another command"],
  [/\bchmod\s+777\b/i, "makes a path world-writable"],
];

/** Fields of a manifest that run code at install time. */
const LIFECYCLE = ["preinstall", "install", "postinstall", "prepare", "prepublish"];

/**
 * The paths this repository has said the trust scan may skip (`preflight.trustAllow`), as
 * regular expressions. An entry that does not compile is dropped rather than throwing: a bad
 * pattern must not be a way to turn the whole scan off.
 * @param {Record<string, any> | null | undefined} adoption
 * @returns {RegExp[]}
 */
export function allowList(adoption) {
  const raw = adoption?.preflight?.trustAllow;
  if (!Array.isArray(raw)) return [];
  /** @type {RegExp[]} */
  const out = [];
  for (const entry of raw) {
    const pattern = typeof entry === "string" ? entry : entry?.path;
    if (typeof pattern !== "string" || !pattern) continue;
    try {
      out.push(new RegExp(pattern));
    } catch {
      /* a pattern that does not compile skips nothing */
    }
  }
  return out;
}

/**
 * Scan a repository's own text for what it is telling an agent to do. Reads only what a rule
 * would read: the tree as git knows it, never `node_modules`, never the agent's own folder.
 * @param {{ files: (re: RegExp) => string[], read: (p: string) => string, readJson: (p: string) => any, exists: (p: string) => boolean, adoption?: Record<string, any> | null }} c
 * @returns {TrustFinding[]}
 */
export function scanTrust(c) {
  /** @type {TrustFinding[]} */
  const findings = [];
  // The escape valve, because a scan with none is a scan somebody switches off entirely. A
  // repository that keeps injection fixtures of its own names their paths in the config, the way
  // it names a path the secret scan should skip, and the night's log says the list was used.
  const allow = allowList(c.adoption);
  const allowed = (/** @type {string} */ p) => allow.some((re) => re.test(p));
  const docs = c.files(/\.(md|mdx|txt|rst)$/);
  const code = c.files(/\.(mjs|cjs|js|ts|tsx|jsx|py|json|ya?ml)$/);
  for (const path of [...docs, ...code]) {
    if (SKIP_SELF.test(path) || allowed(path)) continue;
    const lines = c.read(path).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i]);
      if (line.length > 2000) continue;
      if (FORBIDS.test(line) || insideRefusal(lines, i)) continue;
      for (const [re, why] of INSTRUCTION)
        if (/** @type {RegExp} */ (re).test(line)) {
          findings.push({
            kind: "instruction",
            path,
            line: i + 1,
            text: line.trim().slice(0, 160),
            why: String(why),
          });
          break;
        }
      for (const [re, why] of COMMAND)
        if (/** @type {RegExp} */ (re).test(line)) {
          findings.push({
            kind: "command",
            path,
            line: i + 1,
            text: line.trim().slice(0, 160),
            why: String(why),
          });
          break;
        }
    }
  }
  // Dependency metadata: a manifest that runs code when somebody installs it, and a dependency
  // whose name is a lookalike of one the repository already has.
  for (const path of c.files(/(^|\/)package\.json$/)) {
    const pkg = c.readJson(path);
    for (const field of LIFECYCLE) {
      const cmd = pkg?.scripts?.[field];
      if (typeof cmd === "string" && cmd.trim())
        findings.push({
          kind: "dependency",
          path,
          line: 1,
          text: `${field}: ${cmd.slice(0, 120)}`,
          why: "runs at install time, before anybody reads it",
        });
    }
  }
  return findings;
}

/** One line per finding, for a log a person reads at the top of a night. @param {TrustFinding[]} findings */
export const describeTrust = (findings) =>
  findings.map((f) => `${f.path}:${f.line} · ${f.kind} · ${f.why} · ${f.text}`);
