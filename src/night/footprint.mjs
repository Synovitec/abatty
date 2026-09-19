/**
 * What the harness costs to carry, per session.
 *
 * Every unattended session begins by reading the harness before it reads any code: the context
 * file, the path-scoped rule files, the skill, the agent personas. That is a bill the adopter
 * pays on every session of every night, and nothing was telling them what it is. A standard that
 * quietly eats a third of every context window is a standard people quietly stop installing.
 *
 * The number is an ESTIMATE and is reported as one. Tokenisation belongs to whichever model runs,
 * the same text costs different amounts on different ones, and a session may not read every rule
 * file (that is the point of path scoping). What is exact is the BYTES, and bytes are what a
 * reader can act on: a context file that doubled since last month doubled, whatever the divisor.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Bytes per token, across the current generation of models on English prose with code in it.
 * Deliberately a single round number rather than a per-model table: a table would imply a
 * precision this estimate does not have, and would go stale on its own.
 */
export const BYTES_PER_TOKEN = 4;

/** What a session reads before it reads any code, by what it is for. */
const PARTS = [
  { part: "context file", paths: ["CLAUDE.md", "AGENTS.md"], dir: false },
  { part: "rules", paths: [".claude/rules"], dir: true },
  { part: "skills", paths: [".claude/skills"], dir: true },
  { part: "agents", paths: [".claude/agents"], dir: true },
  { part: "settings", paths: [".claude/settings.json", "abatty.config.json"], dir: false },
];

/** Bytes of a file, or 0. @param {string} p */
function sizeOf(p) {
  try {
    return statSync(p).isFile() ? statSync(p).size : 0;
  } catch {
    return 0;
  }
}

/** Bytes of every file under a directory, recursively. @param {string} dir */
function sizeOfTree(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      total += statSync(p).isDirectory() ? sizeOfTree(p) : sizeOf(p);
    } catch {
      /* unreadable: not counted, and not a crash */
    }
  }
  return total;
}

/**
 * The harness's footprint in a repository: the bytes per part, the total, and an estimated token
 * count. `estimated: true` is on the object rather than in a comment, so a caller that prints it
 * cannot print it as a measurement.
 * @param {string} repoDir
 * @returns {{ estimated: true, bytesPerToken: number, bytes: number, tokens: number, parts: { part: string, bytes: number, tokens: number }[] }}
 */
export function harnessFootprint(repoDir) {
  const parts = PARTS.map((p) => {
    const bytes = p.paths.reduce(
      (n, rel) => n + (p.dir ? sizeOfTree(join(repoDir, rel)) : sizeOf(join(repoDir, rel))),
      0,
    );
    return { part: p.part, bytes, tokens: Math.round(bytes / BYTES_PER_TOKEN) };
  }).filter((p) => p.bytes > 0);
  const bytes = parts.reduce((n, p) => n + p.bytes, 0);
  return {
    estimated: true,
    bytesPerToken: BYTES_PER_TOKEN,
    bytes,
    tokens: Math.round(bytes / BYTES_PER_TOKEN),
    parts,
  };
}

/**
 * The footprint against what a night actually spent: the share of the run's tokens that went on
 * carrying the harness rather than on doing the work. A night of many short sessions pays it
 * many times, which is the thing worth seeing.
 * @param {ReturnType<typeof harnessFootprint>} f
 * @param {{ sessions: number, tokens: number }} spent
 */
export function footprintShare(f, spent) {
  const sessions = Math.max(0, spent.sessions);
  const carried = f.tokens * sessions;
  return {
    perSession: f.tokens,
    sessions,
    carried,
    // Null rather than zero: a night that reported no tokens cannot have a share computed, and
    // a zero there would read as "the harness cost nothing".
    share: spent.tokens > 0 ? Math.round((100 * carried) / spent.tokens) : null,
  };
}

/** One line for a reader. @param {ReturnType<typeof harnessFootprint>} f @param {ReturnType<typeof footprintShare>} [s] */
export function describeFootprint(f, s) {
  const kb = (f.bytes / 1024).toFixed(1);
  const head = `the harness is ${kb} kB, about ${f.tokens} tokens, read at the start of every session (estimated at ${f.bytesPerToken} bytes per token; the bytes are exact, the tokens are not)`;
  if (!s || !s.sessions) return head;
  return `${head}. Over ${s.sessions} session(s) that is about ${s.carried} tokens carried${s.share === null ? "" : `, roughly ${s.share}% of what the night spent`}`;
}
