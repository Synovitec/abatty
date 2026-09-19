/**
 * Scan a repository's own text for what it is telling an agent to do. Reads only what a rule
 * would read: the tree as git knows it, never `node_modules`, never the agent's own folder.
 * @param {{ files: (re: RegExp) => string[], read: (p: string) => string, readJson: (p: string) => any, exists: (p: string) => boolean }} c
 * @returns {TrustFinding[]}
 */
export function scanTrust(c: {
    files: (re: RegExp) => string[];
    read: (p: string) => string;
    readJson: (p: string) => any;
    exists: (p: string) => boolean;
}): TrustFinding[];
export function describeTrust(findings: TrustFinding[]): string[];
export type TrustFinding = {
    kind: "instruction" | "dependency" | "command";
    path: string;
    line: number;
    text: string;
    why: string;
};
