/**
 * Coupled paths: "when this changes, that changes in the same push", declared as pairs of
 * paths (a prefix, or a glob with `*` and `**`) and judged over a range of commits. One
 * mechanism, three uses: the changelog (a source commit is followed or accompanied by a
 * changelog touch), a schema and its migration, an API and its client, a document and the
 * code it describes. The rule is per commit and monotone: a commit that touches a `when` path
 * without a `then` path is an offender until a later commit of the range touches the `then`
 * path, so the cure is always a new commit, never a rewrite.
 */
/** @typedef {{ when: string[], then: string[], why: string, excuse?: RegExp }} Pair `excuse`: a line in a commit's message that stands for the counterpart, said rather than done */
/** @typedef {{ sha: string, subject: string, body?: string, files: string[] }} Commit chronological order */
/** @typedef {{ path: string, detail: string }} Offender */
/**
 * A matcher for a path pattern: a prefix (`src/`, `docs/AUTH.md`), or a glob where `*` is a
 * segment and `**` any depth. Forward slashes only.
 * @param {string} pattern @returns {(path: string) => boolean}
 */
export function pathMatcher(pattern: string): (path: string) => boolean;
/**
 * The pairs a config declares, normalised; a pair without a `when` or a `then` is dropped.
 * @param {unknown} declared @returns {Pair[]}
 */
export function normalisePairs(declared: unknown): Pair[];
/**
 * The offenders of a range: for each pair, every commit touching a `when` path and not a
 * `then` path, unless a later commit of the range touches a `then` path.
 * @param {Commit[]} commits @param {Pair[]} pairs @returns {Offender[]}
 */
export function coupledFindings(commits: Commit[], pairs: Pair[]): Offender[];
/**
 * The same rule at commit time, on the staged files: a commit that touches a `when` path
 * carries a `then` path or says why it does not. Judged before the commit exists rather than a
 * push later, because a rule that refuses the push after the fact punishes pushes, and one that
 * refuses the commit shapes commits (an outside trial hit the push-time refusal four times in
 * two days, each a commit too late). A message line `no-changelog: <reason>` is the decision on
 * the record and passes; the bypass reading counts the same line as reasoned.
 * @param {string[]} staged @param {Pair[]} pairs @param {string} [message]
 * @returns {{ ok: boolean, detail: string }}
 */
export function stagedVerdict(staged: string[], pairs: Pair[], message?: string): {
    ok: boolean;
    detail: string;
};
/**
 * The changelog rule as a pair: the source prefixes, then the changelog.
 * @param {{ changelog: string, changelogRequiredFor: string[] }} c @returns {Pair[]}
 */
export function changelogPairs(c: {
    changelog: string;
    changelogRequiredFor: string[];
}): Pair[];
/**
 * The commits of a range as the mechanism reads them, oldest first.
 * @param {(...args: string[]) => string} git @param {string} range
 * @returns {Commit[]}
 */
export function commitsOf(git: (...args: string[]) => string, range: string): Commit[];
/** A message that says why the counterpart is untouched: a decision, not a hole. */
export const REASON: RegExp;
/**
 * `excuse`: a line in a commit's message that stands for the counterpart, said rather than done
 */
export type Pair = {
    when: string[];
    then: string[];
    why: string;
    excuse?: RegExp;
};
/**
 * chronological order
 */
export type Commit = {
    sha: string;
    subject: string;
    body?: string;
    files: string[];
};
export type Offender = {
    path: string;
    detail: string;
};
