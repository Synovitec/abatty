/**
 * The shape of a rule, checked: what a catalog, a profile and a repository's own rules file
 * are held to before a check of theirs runs.
 */
/** @typedef {import("./index.mjs").Rule} Rule */
/** The problems a rule list has, as messages; none for a well-formed catalog. @param {Rule[]} list */
export function validate(list: Rule[]): string[];
export type Rule = import("./index.mjs").Rule;
