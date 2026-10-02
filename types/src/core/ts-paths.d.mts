/** @typedef {{ dir: string, rules: { prefix: string, suffix: string, targets: string[], exact: boolean }[] }} AliasScope */
/**
 * JSON with the comments and trailing commas a tsconfig is allowed, read as JSON. Strings are
 * copied as they are, so a `//` inside a path is not taken for a comment.
 * @param {string} text @returns {unknown}
 */
export function parseJsonc(text: string): unknown;
/**
 * The alias scopes of the tracked tsconfig files, deepest folder first.
 * @param {string} repoDir @param {string[]} tracked @returns {AliasScope[]}
 */
export function aliasScopes(repoDir: string, tracked: string[]): AliasScope[];
/**
 * The candidate paths an aliased specifier names, written from `from`; empty when no alias of the
 * nearest tsconfig matches it.
 * @param {AliasScope[]} scopes @param {string} from @param {string} spec @returns {string[]}
 */
export function unalias(scopes: AliasScope[], from: string, spec: string): string[];
export type AliasScope = {
    dir: string;
    rules: {
        prefix: string;
        suffix: string;
        targets: string[];
        exact: boolean;
    }[];
};
