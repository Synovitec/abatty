/**
 * The files renamed between `rev` and the working tree, as new path → old path. Empty when git
 * has no such revision or the directory is not a repository. A rename git does not see (an
 * untracked copy, an edit past its similarity threshold) is not carried: the file counts as new.
 * @param {string} repoDir @param {string} rev
 * @returns {Map<string, string>}
 */
export function renamesSince(repoDir: string, rev: string): Map<string, string>;
/**
 * The commit that last wrote the baseline file, or "" when it was never committed.
 * @param {string} repoDir @param {string} rel
 */
export function baselineCommit(repoDir: string, rel: string): string;
/**
 * The baseline with every per-file floor and per-file entry of a renamed file moved to the new
 * path. A key the new path already holds is left alone: a baseline written after the move has
 * the floor where it belongs.
 * @template {{ debt?: Record<string, Record<string, number>>, entries?: Record<string, any> }} B
 * @param {B} baseline @param {Map<string, string>} moved
 * @returns {B}
 */
export function carryRenames<B extends {
    debt?: Record<string, Record<string, number>>;
    entries?: Record<string, any>;
}>(baseline: B, moved: Map<string, string>): B;
