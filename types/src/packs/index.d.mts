/** @param {string} id */
export function packById(id: string): Pack | null;
/**
 * The packs a tree carries: a pack is present when a source file of its extensions or its
 * manifest is in the tree. JavaScript first, so a repository with a build script beside its
 * Python keeps reading as both.
 * @param {(re: RegExp) => string[]} files
 */
export function detectPacks(files: (re: RegExp) => string[]): Pack[];
/**
 * Whether a pack's tool is present in a repository: the config file, the script, or the
 * dependency; the evidence names which. For pyproject.toml the section is checked, since
 * the file exists for every Python project.
 * @param {import("../rules/context.mjs").RepoContext} c @param {Pack} pack @param {keyof Pack["tools"]} tool
 * @returns {{ present: boolean, evidence: string }}
 */
export function toolOf(c: import("../rules/context.mjs").RepoContext, pack: Pack, tool: keyof Pack["tools"]): {
    present: boolean;
    evidence: string;
};
/**
 * Language packs: what a language's tooling is, so the rules keep the same words across
 * languages. A pack names the source extensions, the test-file shape, the manifest, and the
 * tools a rule looks for (the formatter, the linter, the typecheck, the dead-code tool, the
 * test runner) as config files, scripts and dependencies. The context detects the packs of a
 * tree from its files; a rule about "the linter" asks each pack for its linter.
 *
 * JavaScript is the pack the package was built on; Python is the first beyond it, real only
 * when a named repository has run it (the preset says so).
 */
/**
 * @typedef {{ name: string, configs: RegExp, script: RegExp, deps?: string[] }} Tool a tool is found by a config file, a script, or a dependency
 * @typedef {{
 *   id: string,
 *   name: string,
 *   extensions: string[],
 *   source: RegExp,
 *   test: RegExp,
 *   manifest: RegExp,
 *   tools: { formatter: Tool, linter: Tool, typecheck: Tool, dead: Tool, test: Tool },
 * }} Pack
 */
/** @type {Pack} */
export const javascript: Pack;
/** @type {Pack} */
export const python: Pack;
/** @type {Pack[]} */
export const PACKS: Pack[];
/**
 * a tool is found by a config file, a script, or a dependency
 */
export type Tool = {
    name: string;
    configs: RegExp;
    script: RegExp;
    deps?: string[];
};
export type Pack = {
    id: string;
    name: string;
    extensions: string[];
    source: RegExp;
    test: RegExp;
    manifest: RegExp;
    tools: {
        formatter: Tool;
        linter: Tool;
        typecheck: Tool;
        dead: Tool;
        test: Tool;
    };
};
