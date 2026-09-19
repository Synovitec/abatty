/**
 * @typedef {{
 *   id: string,
 *   where: { path: string, line?: number } | null,
 *   what: string,
 *   verify: string,
 *   why: string,
 *   status: import("./index.mjs").Status,
 *   evidence: string,
 * }} AgentFinding
 */
/** A path and a line out of a finding's evidence, when it names one. @param {string} evidence */
export function whereOf(evidence: string): {
    path: string;
    line: number;
} | {
    path: string;
    line?: undefined;
} | null;
export function verifyCommand(id: string): string;
export function agentFinding(f: import("./index.mjs").Finding, rule?: {
    why?: string;
}): AgentFinding;
export function agentFindings(findings: import("./index.mjs").Finding[], rules: import("./index.mjs").CatalogRule[]): AgentFinding[];
export type AgentFinding = {
    id: string;
    where: {
        path: string;
        line?: number;
    } | null;
    what: string;
    verify: string;
    why: string;
    status: import("./index.mjs").Status;
    evidence: string;
};
