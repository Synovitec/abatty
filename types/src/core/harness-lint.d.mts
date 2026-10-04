/**
 * The eslint config that would read `.claude/` and the line that keeps it out, or null when there
 * is no eslint config or it (or `.eslintignore`) already names `.claude`.
 * @param {string} repoDir @returns {{ config: string, line: string, folders: string[] } | null}
 */
export function harnessLintHint(repoDir: string): {
    config: string;
    line: string;
    folders: string[];
} | null;
/**
 * What to tell the reader, in one sentence.
 * @param {{ config: string, line: string, folders?: string[] }} hint @returns {string}
 */
export function harnessLintSays(hint: {
    config: string;
    line: string;
    folders?: string[];
}): string;
