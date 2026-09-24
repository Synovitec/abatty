/**
 * The lines of the repository's pipelines that fall back to the last commit, in a file that also
 * reads the push's `before`: the file that meant to judge the push and, on a new branch, does not.
 * A `HEAD~1` in a file that never reads `before` is some other use and is left alone.
 * @param {string} repoDir @returns {{ file: string, line: number, text: string }[]}
 */
export function narrowFallbacks(repoDir: string): {
    file: string;
    line: number;
    text: string;
}[];
