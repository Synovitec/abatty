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
 * Run a night. Never throws for a refused night: the result carries the reason and the exit
 * code the shell runners used (1 refused, 2 aborted, 3 auto mode unavailable).
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
