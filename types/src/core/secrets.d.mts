/**
 * Scan one text. Two readings are narrowed by where the text lives, because an adopter's scan
 * reported twenty-six findings and none was a secret. In source code the unquoted shape is not
 * read: a literal there is quoted, so `token: config.apiToken` is a variable read and never a
 * leak. In a fixture, a test or a fake, a match on a secret-like NAME counts only when its value
 * looks generated; a provider's own key format is reported wherever it appears.
 * @param {string} path @param {string} text
 */
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
