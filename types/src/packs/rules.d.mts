/**
 * @param {import("../rules/context.mjs").RepoContext} c
 * @param {keyof import("./index.mjs").Pack["tools"]} tool
 * @param {(p: import("./index.mjs").Pack) => boolean} [select] the packs to judge (every one by default)
 * @returns {import("../rules/index.mjs").Verdict}
 */
export function perPack(c: import("../rules/context.mjs").RepoContext, tool: keyof import("./index.mjs").Pack["tools"], select?: (p: import("./index.mjs").Pack) => boolean): import("../rules/index.mjs").Verdict;
