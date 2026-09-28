/**
 * The version of the package this module belongs to. Read here rather than from update.mjs,
 * which reaches the gate through doctor and would close a cycle.
 */
export function runningVersion(): string;
/**
 * Negative when version `a` is older than `b`, by SemVer precedence: a pre-release sorts before
 * its release, and its identifiers compare numerically where both are numbers.
 * @param {string} a @param {string} b @returns {number}
 */
export function compareVersions(a: string, b: string): number;
/**
 * The gate's line when an abatty older than the pin is what runs or what is installed, or "".
 * The copy in node_modules is read when there is one, since the hooks run that copy; the running
 * package is read as well, for a gate started from elsewhere. A line and never a refusal.
 * @param {string} repoDir @param {string} running the version of the package running now
 */
export function pinBehindLine(repoDir: string, running: string): string;
