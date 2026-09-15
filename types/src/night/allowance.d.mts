/**
 * The caps: the command line first, then `allowance` in the config, then 60 USD alone.
 * @param {any} config @param {{ maxCostUsd?: number, maxSessions?: number, maxTokens?: number }} o
 * @returns {Caps}
 */
export function capsOf(config: any, o: {
    maxCostUsd?: number;
    maxSessions?: number;
    maxTokens?: number;
}): Caps;
/** @param {Caps} caps "60 USD", "8 sessions, 60 USD", "2000000 tokens". */
export function describeCaps(caps: Caps): string;
/**
 * The reason the allowance is spent, or "" while it is not.
 * @param {Caps} caps @param {Spent} spent
 */
export function exhausted(caps: Caps, spent: Spent): string;
/** @param {Spent} spent */
export function describeSpent(spent: Spent): string;
/**
 * The tokens a result JSON reports: every input kind and the output, or zero when the agent
 * reports none.
 * @param {any} parsed
 */
export function tokensOf(parsed: any): number;
/**
 * A run file's spend, read back for a resume: the shape checked, never trusted blindly.
 * @param {any} run @returns {Spent | null}
 */
export function spentOf(run: any): Spent | null;
export function nothingSpent(): Spent;
export type Spent = {
    usd: number;
    sessions: number;
    tokens: number;
};
/**
 * zero means no cap on that unit.
 */
export type Caps = {
    usd: number;
    sessions: number;
    tokens: number;
};
