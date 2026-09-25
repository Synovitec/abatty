/**
 * The git hooks brought to this version, as update events. Only init wrote them once, so an
 * adopter who upgraded kept a pre-push hook from before --refs while doctor said no drift; a
 * repository whose hooks live elsewhere (no .githooks folder) is left alone.
 * @param {{ repoDir: string, lock: import("./update.mjs").Lock | null, force: boolean, dryRun: boolean, hash: (text: string) => string, makeExecutable: (path: string) => void }} o
 * @returns {import("./update.mjs").UpdateEvent[]}
 */
export function refreshGitHooks(o: {
    repoDir: string;
    lock: import("./update.mjs").Lock | null;
    force: boolean;
    dryRun: boolean;
    hash: (text: string) => string;
    makeExecutable: (path: string) => void;
}): import("./update.mjs").UpdateEvent[];
