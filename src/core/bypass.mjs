/**
 * The bypass rate (standard SEC.5, research 08 F20).
 *
 * The guard refuses a bypass at the moment it is attempted, which leaves the one that happened
 * where the guard was not: a machine whose hooks were never installed, a commit made with the
 * flag before the harness landed, a pipeline that committed on somebody's behalf. A bypass
 * nobody can see afterwards is a gate with a hole nobody can measure.
 *
 * What is actually detectable, and what this measures: a commit in the pushed range that breaks a
 * rule the hook enforces at commit time. The hook cannot have run and let it through, so either
 * it was not installed or it was bypassed. That is narrower than "somebody typed the flag" and it
 * is the honest version - it needs no cooperation from the machine that made the commit, which is
 * exactly the machine whose cooperation cannot be assumed.
 *
 * A commit that says why in its own message is accepted: the reason is the difference between a
 * decision and a habit.
 */

/** A commit whose message explains the bypass is a decision on the record, not a hole. */
const REASONED = /\b(bypass|hook[- ]skipped|no[- ]gate|no-changelog)\b[^\n]*:\s*\S/i;

/**
 * @typedef {{ sha: string, subject: string, why: string }} BypassFinding
 * @typedef {{ commits: number, bypassed: BypassFinding[], reasoned: BypassFinding[], rate: number }} BypassReading
 */

/**
 * Read a range's commits against the findings the commit-time rules produced for them.
 * @param {{ sha: string, subject: string }[]} commits
 * @param {{ sha: string, detail: string }[]} violations one per commit that broke a commit-time rule
 * @returns {BypassReading}
 */
export function bypassReading(commits, violations) {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  /** @type {BypassFinding[]} */
  const bypassed = [];
  /** @type {BypassFinding[]} */
  const reasoned = [];
  for (const v of violations) {
    const c = bySha.get(v.sha);
    if (!c) continue;
    const finding = { sha: c.sha, subject: c.subject, why: v.detail };
    (REASONED.test(c.subject) ? reasoned : bypassed).push(finding);
  }
  return {
    commits: commits.length,
    bypassed,
    reasoned,
    // The rate a report carries: of the commits in this push, how many got past the hook without
    // saying why. Zero is the only number that is not a conversation.
    rate: commits.length ? Math.round((100 * bypassed.length) / commits.length) : 0,
  };
}

/** One line per commit that got past the hook, for a person reading a pipeline's log. @param {BypassReading} r */
export const describeBypass = (r) =>
  r.bypassed.map((b) => `${b.sha.slice(0, 7)} · ${b.subject.slice(0, 72)} · ${b.why}`);
