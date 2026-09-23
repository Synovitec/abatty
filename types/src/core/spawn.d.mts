/**
 * The executable, the arguments and whether a shell sits between them, for a command name:
 * unchanged everywhere but Windows, where a tool launcher becomes `<name>.cmd` under cmd.exe
 * with the arguments quoted for it.
 * @param {string} command @param {string[]} [args] @returns {Launch}
 */
export function launch(command: string, args?: string[]): Launch;
/**
 * Run an npm script and say how it went; output goes straight to the terminal.
 * @param {string} repoDir @param {string} script @param {string[]} [extraArgs] @returns {RunResult}
 */
export function runScript(repoDir: string, script: string, extraArgs?: string[]): RunResult;
/**
 * A script that exited 1 on Windows, read again: when its program is found nowhere, cmd.exe's 1
 * meant "not recognized", and the step could not run rather than failed.
 * @param {RunResult} res @param {string} repoDir @param {string} script
 * @param {string} [platform] @param {NodeJS.ProcessEnv} [env] @returns {RunResult}
 */
export function notInstalled(res: RunResult, repoDir: string, script: string, platform?: string, env?: NodeJS.ProcessEnv): RunResult;
/** Run a command as given; output goes straight to the terminal. @param {string} repoDir @param {string[]} argv @returns {RunResult} */
export function runCommand(repoDir: string, argv: string[]): RunResult;
export function dockerRunning(): boolean;
export function quoteForCmd(a: string): string;
export function asResult(r: RunResult | number): RunResult;
export type RunResult = {
    code: number;
    errored?: boolean;
    detail?: string;
};
export type Launch = {
    file: string;
    args: string[];
    shell: boolean;
};
