/** @param {string} id */
export function profileById(id: string): Profile | null;
/** The problems a profile has, as messages; none for a well-formed one. @param {any} p */
export function validateProfile(p: any): string[];
/**
 * The names a config gives, normalised: strings, the default when absent.
 * @param {any} config @returns {string[]}
 */
export function profileNames(config: any): string[];
/**
 * Load one profile by name: a built-in id, a file relative to the repository, or a package
 * resolved from the repository's node_modules.
 * @param {string} repoDir @param {string} name
 * @returns {Promise<{ profile: Profile | null, problem: string }>}
 */
export function loadProfile(repoDir: string, name: string): Promise<{
    profile: Profile | null;
    problem: string;
}>;
/**
 * The profiles a repository names, loaded and checked against each other: an id or a rule id
 * that two profiles share is a problem, and the later one loses the rule.
 * @param {string} repoDir @param {any} config
 * @returns {Promise<{ profiles: Profile[], problems: string[] }>}
 */
export function loadProfiles(repoDir: string, config: any): Promise<{
    profiles: Profile[];
    problems: string[];
}>;
/**
 * One catalog from the loaded profiles: every rule with its source (the package's name for
 * the built-in profile, `profile:<id>` for another).
 * @param {Profile[]} profiles @returns {Rule[]}
 */
export function catalogOf(profiles: Profile[]): Rule[];
/** The phases of the loaded profiles that belong to a stage. @param {Profile[]} profiles @param {string} stage */
export function phasesFor(profiles: Profile[], stage: string): Phase[];
/** The phases of the loaded profiles, in order, the first profile's id winning a clash. @param {Profile[]} profiles */
export function phasesOf(profiles: Profile[]): Phase[];
/**
 * @typedef {import("../rules/index.mjs").Rule} Rule
 * @typedef {{ id: string, title: string, size?: string, blocksOn?: string[], exit?: string, stages?: import("../rules/stage.mjs").Stage[] }} Phase
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   rules: Rule[],
 *   phases: Phase[],
 *   presets?: string[],
 *   harnessRules?: string[],
 *   standard?: { document?: string, plan?: string },
 *   tools?: Record<string, string>,
 *   source?: string,
 * }} Profile a profile's `tools` name what its rules leave unnamed: the CI providers, the database, the schema library, the browser runner.
 */
/** The built-in profiles. @type {Profile[]} */
export const PROFILES: Profile[];
/** The profile a repository is measured against when its config names none. */
export const DEFAULT_PROFILES: string[];
export type Rule = import("../rules/index.mjs").Rule;
export type Phase = {
    id: string;
    title: string;
    size?: string;
    blocksOn?: string[];
    exit?: string;
    stages?: import("../rules/stage.mjs").Stage[];
};
/**
 * a profile's `tools` name what its rules leave unnamed: the CI providers, the database, the schema library, the browser runner.
 */
export type Profile = {
    id: string;
    name: string;
    description?: string;
    rules: Rule[];
    phases: Phase[];
    presets?: string[];
    harnessRules?: string[];
    standard?: {
        document?: string;
        plan?: string;
    };
    tools?: Record<string, string>;
    source?: string;
};
