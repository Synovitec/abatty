/** @param {string} id @param {Rule[]} [catalog] */
export function ruleById(id: string, catalog?: Rule[]): Rule | null;
/** The problems a rule list has, as messages; none for a well-formed catalog. @param {Rule[]} list */
export function validate(list: Rule[]): string[];
/**
 * The rules file of a repository: `abatty.rules.mjs` at the root, or the path named by
 * adoption.json → rules.local. Exports `rules` (an array) or a default array. Returns the
 * loaded rules and the problems found; a missing file is neither.
 * @param {string} repoDir @param {Record<string, any> | null} adoption
 * @returns {Promise<{ file: string | null, rules: Rule[], problems: string[] }>}
 */
export function loadLocalRules(repoDir: string, adoption: Record<string, any> | null): Promise<{
    file: string | null;
    rules: Rule[];
    problems: string[];
}>;
/**
 * The catalog of a repository: the built-in rules, its own, and the waivers applied. A waiver
 * names a reason; one with an `until` date in the past no longer waives.
 * @param {string} repoDir @param {{ adoption?: Record<string, any> | null, today?: string }} [o]
 * @returns {Promise<{ rules: CatalogRule[], localFile: string | null, problems: string[] }>}
 */
export function loadCatalog(repoDir: string, o?: {
    adoption?: Record<string, any> | null;
    today?: string;
}): Promise<{
    rules: CatalogRule[];
    localFile: string | null;
    problems: string[];
}>;
/**
 * Run a catalog against a context: one finding per rule, in catalog order. A check that throws
 * is a finding too (status missing, the error as evidence), never a crash of the measurement.
 * @param {RepoContext} ctx @param {CatalogRule[]} [catalog]
 * @returns {Finding[]}
 */
export function runCatalog(ctx: RepoContext, catalog?: CatalogRule[]): Finding[];
/**
 * The enforced share: of the rules a repository has (present or partial), the part a machine
 * holds (hard, ratchet) against the part only a reviewer or a sentence holds (review, prose).
 * The number that says how much of a written standard is actually enforced; the rules under
 * review or prose are what a night moves up a level next.
 * @param {Finding[]} findings
 * @returns {{ share: number | null, total: number, hard: number, ratchet: number, review: number, prose: number, promotable: string[] }}
 */
export function enforcedOf(findings: Finding[]): {
    share: number | null;
    total: number;
    hard: number;
    ratchet: number;
    review: number;
    prose: number;
    promotable: string[];
};
/** The score of a list of findings: present = 1, partial = 0.5, over the applicable ones. @param {Finding[]} findings */
export function scoreOf(findings: Finding[]): {
    score: number;
    applicable: number;
};
/**
 * @typedef {"present" | "partial" | "missing" | "n/a" | "waived"} Status
 * @typedef {"must" | "should"} Level
 * @typedef {"hard" | "ratchet" | "review" | "prose"} Enforcement
 * @typedef {{ status: Status, evidence: string, next?: string }} Verdict
 * @typedef {import("./context.mjs").RepoContext} RepoContext
 *
 * @typedef {object} Rule
 * @property {string} id the check's ID, FAMILY-NAME, unique across the catalog
 * @property {string} family the family the reports group by
 * @property {string} title the rule in one line
 * @property {string[]} [standard] the standard's rule IDs this check holds (CODE-6, DOC-2 ...)
 * @property {Level} level must, or should
 * @property {Enforcement} enforcement what insures it once present: hard (a machine refuses), ratchet (a number that may only fall), review (a checklist item), prose
 * @property {string} phase the adoption plan phase that installs it ("0", "A.1", "-" for none)
 * @property {string} why the reason, one or two sentences
 * @property {string} next what to do when the finding is not present
 * @property {(ctx: RepoContext) => Verdict} check the finding for a repository
 * @property {string} [source] "abatty" for the built-in rules, the file path for a repository's own
 *
 * @typedef {Rule & { waived?: { reason: string, until?: string } }} CatalogRule
 * @typedef {{ id: string, family: string, rule: string, status: Status, evidence: string, next: string, phase: string, level: Level, enforcement: Enforcement, standard: string[] }} Finding
 */
/** The built-in rules, in the order the reports print them. @type {Rule[]} */
export const RULES: Rule[];
/** The families, in catalog order. */
export const FAMILIES: string[];
export type Status = "present" | "partial" | "missing" | "n/a" | "waived";
export type Level = "must" | "should";
export type Enforcement = "hard" | "ratchet" | "review" | "prose";
export type Verdict = {
    status: Status;
    evidence: string;
    next?: string;
};
export type RepoContext = import("./context.mjs").RepoContext;
export type Rule = {
    /**
     * the check's ID, FAMILY-NAME, unique across the catalog
     */
    id: string;
    /**
     * the family the reports group by
     */
    family: string;
    /**
     * the rule in one line
     */
    title: string;
    /**
     * the standard's rule IDs this check holds (CODE-6, DOC-2 ...)
     */
    standard?: string[] | undefined;
    /**
     * must, or should
     */
    level: Level;
    /**
     * what insures it once present: hard (a machine refuses), ratchet (a number that may only fall), review (a checklist item), prose
     */
    enforcement: Enforcement;
    /**
     * the adoption plan phase that installs it ("0", "A.1", "-" for none)
     */
    phase: string;
    /**
     * the reason, one or two sentences
     */
    why: string;
    /**
     * what to do when the finding is not present
     */
    next: string;
    /**
     * the finding for a repository
     */
    check: (ctx: RepoContext) => Verdict;
    /**
     * "abatty" for the built-in rules, the file path for a repository's own
     */
    source?: string | undefined;
};
export type CatalogRule = Rule & {
    waived?: {
        reason: string;
        until?: string;
    };
};
export type Finding = {
    id: string;
    family: string;
    rule: string;
    status: Status;
    evidence: string;
    next: string;
    phase: string;
    level: Level;
    enforcement: Enforcement;
    standard: string[];
};
