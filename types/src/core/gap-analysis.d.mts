/**
 * Run a catalog (the built-in rules by default) over a repository, synchronously.
 * @param {string} repoDir @param {{ today?: string, catalog?: import("../rules/index.mjs").CatalogRule[], problems?: string[], profiles?: string[], phases?: import("../profiles/index.mjs").Phase[] }} [o]
 * @returns {GapResult}
 */
export function analyze(repoDir: string, o?: {
    today?: string;
    catalog?: import("../rules/index.mjs").CatalogRule[];
    problems?: string[];
    profiles?: string[];
    phases?: import("../profiles/index.mjs").Phase[];
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
/** @param {string} p */
/**
 * The findings still to do, in the plan's own order. Reading the first number out of the phase
 * was the bug: "A.1" is day 0 and read as 1, so the whole of phase 0 was listed ahead of the
 * day-0 work that blocks it. The plan declares its order, and a phase it does not carry sorts
 * last rather than in the middle.
 * @param {Finding[]} findings @param {string[]} [order] the phase ids in plan order
 */
export function todoOf(findings: Finding[], order?: string[]): import("../rules/index.mjs").Finding[];
/**
 * The dated Markdown report for a result of analyze(), with the standard's front matter.
 * @param {GapResult} result
 */
export function renderMarkdown(result: GapResult): string;
/**
 * What the present gate-step checks are worth: proven by a control, contradicted by the machine
 * (and counted as partial above), or not yet shown either way. Empty when no step was read.
 * @param {Pick<GapResult, "truth">} result
 */
export function truthLine(result: Pick<GapResult, "truth">): string;
/** The console summary the CLI prints under the report. @param {GapResult} result @param {string} [reportPath] */
export function renderSummary(result: GapResult, reportPath?: string): string;
export type Finding = import("../rules/index.mjs").Finding;
export type Enforced = ReturnType<typeof enforcedOf>;
export type Waivers = ReturnType<typeof waiverOf>;
export type GapResult = {
    repo: string;
    name: string;
    date: string;
    score: number;
    applicable: number;
    truth?: import("./truth.mjs").Truth;
    enforced: Enforced;
    findings: Finding[];
    families: string[];
    waived: number;
    waivers?: Waivers;
    problems: string[];
    profiles: string[];
    stage: string;
    stageFrom: string;
    plan: import("../rules/phases.mjs").PhaseCount[];
    phase: import("../rules/phases.mjs").PhaseCount | null;
};
import { enforcedOf } from "../rules/index.mjs";
import { waiverOf } from "../rules/index.mjs";
