/** The problems a rule list has, as messages; none for a well-formed catalog. @param {Rule[]} list */
export function validate(list: Rule[]): string[];
export type Rule = import("./index.mjs").Rule;
