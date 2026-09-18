/** Tracked text files, minus the allow-list and the vocabulary itself. @param {string} repoDir @param {string[]} allow */
export function scannableFiles(repoDir: string, allow?: string[]): string[];
/** Findings in the tracked files. @param {string} repoDir @param {{ allow?: string[] }} [o] */
export function scanFiles(repoDir: string, o?: {
    allow?: string[];
}): ScrubFinding[];
/** Findings in commit messages over a range (default: the whole history of the current branch). @param {string} repoDir @param {string} [range] */
export function scanCommits(repoDir: string, range?: string): ScrubFinding[];
/** Findings in the pull requests of the GitHub repository (title and body), via gh. @param {string} repoDir @param {number} [limit] */
export function scanPullRequests(repoDir: string, limit?: number): {
    ok: boolean;
    findings: ScrubFinding[];
    error: string;
};
/**
 * Rewrite the tracked files by the word map, longest keys first, case-sensitive; returns the
 * files changed. The map is the repository's (`adoption.json` → `scrub.map`) over the default.
 * @param {string} repoDir @param {Record<string,string>} map @param {{ allow?: string[], dryRun?: boolean }} [o]
 */
export function fixFiles(repoDir: string, map: Record<string, string>, o?: {
    allow?: string[];
    dryRun?: boolean;
}): string[];
/**
 * The scrub's configuration: OFF unless the repository opted in (`scrub.enabled: true` in the
 * adoption config or in `abatty.config.json` at the root, the root winning), with its allow
 * list, its word map and the provenance trailer the repository asks for on unattended commits.
 * Provenance is the default: a tool that audits an agent's runs does not erase them; the
 * scrub is white-label hygiene a repository chooses, with the reason in its decisions file.
 * @param {string} repoDir
 * @returns {{ enabled: boolean, allow: string[], map: Record<string, string>, trailer: string }}
 */
export function scrubConfig(repoDir: string): {
    enabled: boolean;
    allow: string[];
    map: Record<string, string>;
    trailer: string;
};
/** The per-repository allow-list: `scrub.allow` of the adoption config and of `abatty.config.json` at the root. @param {string} repoDir */
export function allowList(repoDir: string): string[];
export type ScrubFinding = {
    kind: "file" | "commit" | "pr";
    where: string;
    line?: number;
    text: string;
};
