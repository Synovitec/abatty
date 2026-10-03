/**
 * The lint files and every module they import that lives in this tree, read as one text: a
 * relative import, or a workspace package by its name, two levels deep.
 * @param {string[]} lintFiles @param {(f: string) => string} read
 * @param {(re: RegExp) => string[]} files the tracked files matching a pattern
 * @returns {string}
 */
export function lintConfigText(lintFiles: string[], read: (f: string) => string, files: (re: RegExp) => string[]): string;
