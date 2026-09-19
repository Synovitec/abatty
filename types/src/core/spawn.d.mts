/**
 * Run an npm script and say how it went; output goes straight to the terminal.
 * @param {string} repoDir @param {string} script @param {string[]} [extraArgs] @returns {RunResult}
 */
export function runScript(repoDir: string, script: string, extraArgs?: string[]): RunResult;
/** Run a command as given; output goes straight to the terminal. @param {string} repoDir @param {string[]} argv @returns {RunResult} */
export function runCommand(repoDir: string, argv: string[]): RunResult;
export function dockerRunning(): boolean;
export function bin(command: string): string;
export function asResult(r: RunResult | number): RunResult;
export type RunResult = {
    code: number;
    errored?: boolean;
    detail?: string;
};
