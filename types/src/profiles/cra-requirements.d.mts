/**
 * How much of the mapping is even claimed. Reported next to any coverage figure, because a
 * requirement with no rule behind it is the most important thing this table has to say.
 */
export function mappingShape(): {
    total: number;
    withRules: number;
    withoutRules: number;
    rules: string[];
};
/**
 * The mapping against a repository's findings: per requirement, what each named rule reads here.
 * A rule that is not in this repository's catalog is reported as absent rather than skipped, so
 * a profile that drops a rule cannot silently improve the coverage figure.
 * @param {import("../rules/index.mjs").Finding[]} findings
 */
export function mapRequirements(findings: import("../rules/index.mjs").Finding[]): {
    evidence: {
        rule: string;
        status: string;
        evidence: string;
    }[];
    standing: string;
    id: string;
    part: "I" | "II";
    title: string;
    rules: string[];
    covers: string;
    gap: string;
}[];
export namespace REGULATION {
    let name: string;
    let annex: string;
    let warning: string;
}
/** @type {Requirement[]} */
export const REQUIREMENTS: Requirement[];
export type Requirement = {
    id: string;
    part: "I" | "II";
    title: string;
    rules: string[];
    covers: string;
    gap: string;
};
