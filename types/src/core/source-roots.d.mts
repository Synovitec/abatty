/**
 * The source roots that exist here, and whether they are a monorepo's workspace folders.
 * @param {string} repoDir @returns {{ roots: string[], mono: boolean }}
 */
export function sourceRoots(repoDir: string): {
    roots: string[];
    mono: boolean;
};
/** The roots as `depcruise` takes them, "." where none exists. @param {string} repoDir */
export function graphRoots(repoDir: string): string;
/**
 * knip's `project` list over the roots of a single package, written into the template in place
 * of its default. A monorepo keeps the default, since knip reads each workspace on its own.
 * @param {string} repoDir @param {string} template the knip.jsonc text @returns {string}
 */
export function knipForRoots(repoDir: string, template: string): string;
/**
 * The dependency-cruiser config for this repository: the template, less its `tsConfig` where the
 * root has no tsconfig.json. A monorepo root keeps its tsconfigs in the workspaces, and depcruise
 * refused to start (TS5083: cannot read file 'tsconfig.json').
 * @param {string} repoDir @param {string} template @returns {string}
 */
export function depcruiseFor(repoDir: string, template: string): string;
