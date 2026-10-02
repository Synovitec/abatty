/**
 * The families installed at more than one version, each with what is installed.
 * @param {string} repoDir @returns {{ family: string, versions: string }[]}
 */
export function splitPairs(repoDir: string): {
    family: string;
    versions: string;
}[];
