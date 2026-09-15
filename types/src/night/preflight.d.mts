/** @param {string} p @param {unknown} v JSON without a BOM, LF, a trailing newline: the way the hooks read it back. */
export function writeJson(p: string, v: unknown): void;
/** @param {string} p @returns {any} */
export function readJson(p: string): any;
/**
 * @typedef {import("./runner.mjs").NightOptions} NightOptions
 * @typedef {import("./runner.mjs").NightResult} NightResult
 * @typedef {{
 *   agent: string, config: any, base: string, stateFile: string, decisionsFile: string,
 *   maxSessions: number, phases: string[], date: string, branch: string, nightDir: string,
 *   startedAt: string, mcpConfig: string, mcpServers: string[],
 *   harnessMoved: (when: string) => string,
 *   adapter: import("../agents/index.mjs").Adapter,
 * }} Preflight
 */
/**
 * Run the pre-flight. Returns the night's facts, or the refusal as a NightResult.
 * @param {NightOptions} o
 * @param {{ repoDir: string, log: (l: string) => void, until: string, maxCost: number, refuse: (why: string, code?: number) => NightResult }} c
 * @returns {Preflight | NightResult}
 */
export function preflight(o: NightOptions, c: {
    repoDir: string;
    log: (l: string) => void;
    until: string;
    maxCost: number;
    refuse: (why: string, code?: number) => NightResult;
}): Preflight | NightResult;
export const HARNESS_FILES: string[];
export type NightOptions = import("./runner.mjs").NightOptions;
export type NightResult = import("./runner.mjs").NightResult;
export type Preflight = {
    agent: string;
    config: any;
    base: string;
    stateFile: string;
    decisionsFile: string;
    maxSessions: number;
    phases: string[];
    date: string;
    branch: string;
    nightDir: string;
    startedAt: string;
    mcpConfig: string;
    mcpServers: string[];
    harnessMoved: (when: string) => string;
    adapter: import("../agents/index.mjs").Adapter;
};
