/**
 * The line `doctor` and `update` print for a stale patch, in one place so the two cannot drift.
 * A patch with no version or with a range applies to every version, which is the case this
 * exists for, so it is named whatever the version running.
 * @param {{ where: string, patched: string }} p @param {string} version
 * @returns {{ says: string, fix: string }}
 */
export function stalePatchNote(p: {
    where: string;
    patched: string;
}, version: string): {
    says: string;
    fix: string;
};
/**
 * The patches of abatty this repository carries for a version other than `version`, each with
 * where it is declared. Read from `patchedDependencies` (bun, npm), `pnpm.patchedDependencies`,
 * and the files a patch tool leaves under `patches/`.
 * @param {string} repoDir @param {string} version the abatty version running
 * @returns {{ where: string, patched: string }[]}
 */
export function stalePatches(repoDir: string, version: string): {
    where: string;
    patched: string;
}[];
