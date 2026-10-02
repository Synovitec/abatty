/**
 * The file holding the context, whether the repository wrote it, and its unfilled placeholders.
 * @param {string} repoDir
 * @returns {{ file: string, own: boolean, placeholders: number }}
 */
export function contextState(repoDir: string): {
    file: string;
    own: boolean;
    placeholders: number;
};
