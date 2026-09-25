/**
 * @typedef {{
 *   repoDir: string,
 *   until?: string,
 *   maxCostUsd?: number,
 *   phases?: string[],
 *   model?: string,
 *   effort?: string,
 *   mode?: "auto" | "dontAsk",
 *   noPush?: boolean,
 *   skipCanary?: boolean,
 *   canaryOnly?: boolean,
 *   agent?: string,
 *   sandbox?: "auto" | "required" | "off",
 *   maxSessions?: number,
 *   maxTokens?: number,
 *   resume?: boolean,
 *   log?: (line: string) => void,
 * }} NightOptions
 * @typedef {{ ok: boolean, code: number, abort: string, spent: number, sessions: number, tokens: number, branch: string, pushed: boolean, canaryOnly?: boolean }} NightResult
 */
/**
 * Run a night. Never throws for a refused night: the result carries the reason and an exit code
 * from the one table (src/cli/exit.mjs): 2 it cannot start as configured (no agent), 3 the
 * pre-flight found the repository unfit for a night (a dirty tree, a red gate, a step that
 * stayed green on its control), 4 the harness did not hold here (the canary) or the night
 * aborted once running (the harness moved, the agent crashed twice, auto mode did not take).
 * The shell runners' own 1, 2 and 3 meant other things, and an adopter's script could not tell
 * a dirty tree from an abort.
 * @param {NightOptions} o
 * @returns {NightResult}
 */
export function runNight(o: NightOptions): NightResult;
export type NightOptions = {
    repoDir: string;
    until?: string;
    maxCostUsd?: number;
    phases?: string[];
    model?: string;
    effort?: string;
    mode?: "auto" | "dontAsk";
    noPush?: boolean;
    skipCanary?: boolean;
    canaryOnly?: boolean;
    agent?: string;
    sandbox?: "auto" | "required" | "off";
    maxSessions?: number;
    maxTokens?: number;
    resume?: boolean;
    log?: (line: string) => void;
};
export type NightResult = {
    ok: boolean;
    code: number;
    abort: string;
    spent: number;
    sessions: number;
    tokens: number;
    branch: string;
    pushed: boolean;
    canaryOnly?: boolean;
};
