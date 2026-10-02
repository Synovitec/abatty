/** @typedef {"vitest" | "bun test" | "jest" | "node --test" | ""} Runner */
/**
 * The runner a script names, or "" when it names none (a wrapper like `node scripts/test.mjs`, a
 * hand-off like `turbo run test`).
 * @param {string} script @returns {Runner}
 */
export function runnerOfScript(script: string): Runner;
/**
 * The runner of a repository: its own test script, else the first workspace's, else an installed
 * runner, else the platform's when a test imports `node:test`. "" when nothing says, which is
 * reported rather than guessed.
 * @param {string} repoDir @returns {Runner}
 */
export function runnerOf(repoDir: string): Runner;
/**
 * The command that runs a set of test files on the repository's runner, `{files}` where they go,
 * through its package manager for an installed runner. "" when the runner is unknown.
 * @param {string} repoDir @returns {string}
 */
export function testFilesCommand(repoDir: string): string;
export type Runner = "vitest" | "bun test" | "jest" | "node --test" | "";
