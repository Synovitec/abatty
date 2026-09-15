/**
 * @typedef {import("../rules/index.mjs").Finding} Finding
 * @typedef {ReturnType<typeof enforcedOf>} Enforced
 * @typedef {{ repo: string, name: string, date: string, score: number, applicable: number, enforced: Enforced, findings: Finding[], families: string[], waived: number, problems: string[], profiles: string[], stage: string, stageFrom: string }} GapResult
 */
/**
 * Run a catalog (the built-in rules by default) over a repository, synchronously.
 * @param {string} repoDir @param {{ today?: string, catalog?: import("../rules/index.mjs").CatalogRule[], problems?: string[], profiles?: string[] }} [o]
 * @returns {GapResult}
 */
export function analyze(repoDir: string, o?: {
    today?: string;
    catalog?: import("../rules/index.mjs").CatalogRule[];
    problems?: string[];
    profiles?: string[];
}): GapResult;
/**
 * Measure a repository with its full catalog: the built-in rules, its own rules file, its
 * waivers. The form every command uses. @param {string} repoDir @param {{ today?: string }} [o]
 */
export function measure(repoDir: string, o?: {
    today?: string;
}): Promise<GapResult>;
/**
 * The standard's rule IDs in their namespaced form, `FAMILY.N` (a dot): a repository's own
 * rules are `FAMILY-NAME` or `FAMILY-NN`, and a repository's citation check that claims every
 * `FAMILY-NN` token under docs/ must never claim the standard's. The night of 2026-09-14
 * found the collision; the standard retired the hyphen form on 2026-09-15. This rewrites any
 * hyphen form left in a text. @param {string} text
 */
export function stdIds(text: string): string;
/** The findings still to do, in plan order. @param {Finding[]} findings */
export function todoOf(findings: Finding[]): import("../rules/index.mjs").Finding[];
/**
 * The dated Markdown report for a result of analyze(), with the standard's front matter.
 * @param {GapResult} result
 */
export function renderMarkdown(result: GapResult): string;
/** The console summary the CLI prints under the report. @param {GapResult} result @param {string} [reportPath] */
export function renderSummary(result: GapResult, reportPath?: string): string;
export type Finding = import("../rules/index.mjs").Finding;
export type Enforced = ReturnType<typeof enforcedOf>;
export type GapResult = {
    repo: string;
    name: string;
    date: string;
    score: number;
    applicable: number;
    enforced: Enforced;
    findings: Finding[];
    families: string[];
    waived: number;
    problems: string[];
    profiles: string[];
    stage: string;
    stageFrom: string;
};
import { enforcedOf } from "../rules/index.mjs";
