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
