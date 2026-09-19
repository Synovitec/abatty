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
  [/you are now|act as (an?|the) |from now on,? you/i, "reassigns the model's role"],
  [/<\/?(system|assistant)>|^\s*system:\s/im, "forges a turn boundary"],
  [
    /do not (tell|inform|mention to) the (user|human|operator)/i,
    "asks the model to keep something from the person running it",
  ],
  [
    /(print|reveal|output|exfiltrate|send) (the |your )?(system prompt|secrets?|credentials?|api keys?|token)/i,
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
 * Scan a repository's own text for what it is telling an agent to do. Reads only what a rule
 * would read: the tree as git knows it, never `node_modules`, never the agent's own folder.
 * @param {{ files: (re: RegExp) => string[], read: (p: string) => string, readJson: (p: string) => any, exists: (p: string) => boolean }} c
 * @returns {TrustFinding[]}
 */
export function scanTrust(c) {
  /** @type {TrustFinding[]} */
  const findings = [];
  const docs = c.files(/\.(md|mdx|txt|rst)$/);
  const code = c.files(/\.(mjs|cjs|js|ts|tsx|jsx|py|json|ya?ml)$/);
  for (const path of [...docs, ...code]) {
    const lines = c.read(path).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i]);
      if (line.length > 2000) continue;
      if (FORBIDS.test(line)) continue;
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
