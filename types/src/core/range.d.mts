/**
 * What the push contains. `@{u}..HEAD` while the upstream is still an ancestor of HEAD; after
 * a rebase or an amend it is not, and the diff would show the amend delta rather than the
 * push (which is how a push carrying twenty UI files once skipped the browser suite), so the
 * whole branch is judged instead; with no upstream, the fork point from the base; failing
 * that, the last commit.
 */
/**
 * @typedef {"explicit" | "upstream" | "fork" | "unknown"} RangeHow
 * @typedef {{ range: string, how: RangeHow, commits: number }} RangeInfo
 */
/**
 * The push range and how it was found, because "could not be found" is a different answer from
 * "found and empty" and the gate must not read the two alike. `commits` is what the range holds,
 * -1 when git cannot list it (a shallow clone whose `HEAD~1` does not exist).
 * @param {string} repoDir @param {string} [base] @param {string} [explicit] @returns {RangeInfo}
 */
export function pushRangeInfo(repoDir: string, base?: string, explicit?: string): RangeInfo;
/**
 * What a range given by hand leaves out: the commits the branch carries since it left the base
 * that the range does not hold. A CI run on a new branch has no `before` to diff from, and a
 * hand-written fallback of `HEAD~1` judged one commit of four and printed green, which read as
 * the branch being judged. Null on the base itself, with no base to fork from, or when the range
 * already holds the branch. Said, not refused: a narrower range may be exactly what was meant.
 * @param {string} repoDir @param {string} base @param {RangeInfo} info
 * @returns {{ commits: number, fork: string } | null}
 */
export function narrowerThanBranch(repoDir: string, base: string, info: RangeInfo): {
    commits: number;
    fork: string;
} | null;
/** The push range alone (see pushRangeInfo). @param {string} repoDir @param {string} [base] @param {string} [explicit] */
export function pushRange(repoDir: string, base?: string, explicit?: string): string;
/** Files whose content on disk differs from HEAD: staged, unstaged, untracked. @param {string} repoDir */
export function pendingPaths(repoDir: string): string[];
/**
 * The files a range changed, repository-relative. A finding in a file this change never touched
 * is not this change's finding, however true it is, and telling the two apart is the difference
 * between a gate a team acts on and a list they learn to scroll past.
 * @param {string} repoDir @param {string} range
 */
export function changedPaths(repoDir: string, range: string): string[];
export type RangeHow = "explicit" | "upstream" | "fork" | "unknown";
export type RangeInfo = {
    range: string;
    how: RangeHow;
    commits: number;
};
