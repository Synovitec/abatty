/**
 * The language a repository is written in that no preset covers, by the first mark found; ""
 * when none is there.
 * @param {(re: RegExp) => string[]} files the repository's tracked files matching a pattern
 * @returns {string}
 */
export function foreignLanguage(files: (re: RegExp) => string[]): string;
