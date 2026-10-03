/**
 * Every package imported from tracked sources that no package.json in the repository declares
 * (dependencies of any kind, at the root or a workspace) and that is not a workspace itself.
 * @param {string} repoDir @returns {{ name: string, files: number }[]}
 */
export function undeclaredImports(repoDir: string): {
    name: string;
    files: number;
}[];
