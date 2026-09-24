/** Compile regex sources once per call site. @param {string[]} sources */
export function regexes(sources: string[]): RegExp[];
/** True when a path matches any of the sources. @param {string} path @param {RegExp[]} list */
export function matchesAny(path: string, list: RegExp[]): boolean;
/**
 * The code-line budget of a path: the first kind whose pattern matches, else the module budget.
 * @param {string} path @param {import("../index.mjs").RatchetConfig} config
 * @returns {{ kind: string, max: number }}
 */
export function budgetOf(path: string, config: import("../index.mjs").RatchetConfig): {
    kind: string;
    max: number;
};
/**
 * The front matter of a Markdown document as a flat map: scalar values as strings, `[...]`
 * lists as arrays of strings, `- item` lists under a key as arrays. Null when the document does
 * not open with `---`.
 * @param {string} text
 * @returns {Record<string, string | string[]> | null}
 */
export function frontMatter(text: string): Record<string, string | string[]> | null;
/**
 * The JavaScript and TypeScript sources a probe of what ships reads: outside the exempt list and
 * outside test folders at any depth, where a monorepo keeps them (`apps/<app>/tests/`). A test's
 * setup that logs and carries on, or a fixture's random password, is not what a user meets.
 * @param {import("../../rules/context.mjs").RepoContext} c @param {{ config: { exempt: string[] } }} o
 */
export function shippedScripts(c: import("../../rules/context.mjs").RepoContext, o: {
    config: {
        exempt: string[];
    };
}): string[];
/** Lines of a text, CRLF or LF. @param {string} text */
export function lines(text: string): string[];
