/** Scan one text. @param {string} path @param {string} text */
export function scanText(path: string, text: string): SecretFinding[];
/** The allow-list of paths: `secrets.allow` in the config. @param {string} repoDir */
export function secretsAllow(repoDir: string): any;
/**
 * Scan files of the repository. `mode`: "tree" (tracked and untracked-but-not-ignored),
 * "staged" (the index, for the pre-commit hook), or a git range (the files it touched).
 * @param {string} repoDir @param {{ mode?: "tree" | "staged" | string, allow?: string[] }} [o]
 * @returns {{ scanned: number, findings: SecretFinding[] }}
 */
export function scanSecrets(repoDir: string, o?: {
    mode?: "tree" | "staged" | string;
    allow?: string[];
}): {
    scanned: number;
    findings: SecretFinding[];
};
/** @type {[kind: string, re: RegExp][]} */
export const SHAPES: [kind: string, re: RegExp][];
export type SecretFinding = {
    path: string;
    line: number;
    kind: string;
    sample: string;
};
