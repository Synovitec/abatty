/**
 * The identity of a reading: the package's version, the committed tree, and the content of every
 * file that differs from it. Null when this is not a git repository, because then there is no
 * cheap way to know what changed and the honest answer is to measure.
 * @param {string} repoDir @param {{ version?: string, catalog?: string[] }} [o]
 */
export function cacheKey(repoDir: string, o?: {
    version?: string;
    catalog?: string[];
}): string | null;
/** The reading kept under this key, or null. @param {string} repoDir @param {string | null} key */
export function readCache(repoDir: string, key: string | null): any;
/**
 * Keep a reading under its key, and keep the folder small: the readings are worth nothing once
 * their key is stale, and an unbounded cache folder is a bug report waiting to happen.
 * @param {string} repoDir @param {string | null} key @param {unknown} value @param {number} [keep]
 */
export function writeCache(repoDir: string, key: string | null, value: unknown, keep?: number): void;
/** The package's own folder in a repository: gitignored, so nothing in it is ever an input a rule may depend on. */
export const CACHE_ROOT: ".abatty";
/** Where measurements are cached, keyed by the content of everything a rule could read and never by a time, so a cache can never turn a finding into a pass. */
export const CACHE_DIR: string;
