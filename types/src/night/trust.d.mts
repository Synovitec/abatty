/**
 * The paths this repository has said the trust scan may skip (`preflight.trustAllow`), as
 * regular expressions. An entry that does not compile is dropped rather than throwing: a bad
 * pattern must not be a way to turn the whole scan off.
 * @param {Record<string, any> | null | undefined} adoption
 * @returns {RegExp[]}
 */
export function allowList(adoption: Record<string, any> | null | undefined): RegExp[];
/**
 * Scan a repository's own text for what it is telling an agent to do. Reads only what a rule
 * would read: the tree as git knows it, never `node_modules`, never the agent's own folder.
 * @param {{ files: (re: RegExp) => string[], read: (p: string) => string, readJson: (p: string) => any, exists: (p: string) => boolean, adoption?: Record<string, any> | null }} c
 * @returns {TrustFinding[]}
 */
export function scanTrust(c: {
    files: (re: RegExp) => string[];
    read: (p: string) => string;
    readJson: (p: string) => any;
    exists: (p: string) => boolean;
    adoption?: Record<string, any> | null;
}): TrustFinding[];
export function describeTrust(findings: TrustFinding[]): string[];
export type TrustFinding = {
    kind: "instruction" | "dependency" | "command";
    path: string;
    line: number;
    text: string;
    why: string;
};
