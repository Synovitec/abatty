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
export function bypassReading(commits: {
    sha: string;
    subject: string;
}[], violations: {
    sha: string;
    detail: string;
}[]): BypassReading;
export function describeBypass(r: BypassReading): string[];
export type BypassFinding = {
    sha: string;
    subject: string;
    why: string;
};
export type BypassReading = {
    commits: number;
    bypassed: BypassFinding[];
    reasoned: BypassFinding[];
    rate: number;
};
