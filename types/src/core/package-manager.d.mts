/**
 * The package manager of a repository, or null when nothing it committed names one: no
 * `packageManager` field and no lockfile.
 * @param {string} repoDir @returns {PackageManager | null}
 */
export function packageManager(repoDir: string): PackageManager | null;
/**
 * The manager a repository's own files should speak: the one it committed, npm when nothing it
 * committed names one. A hook that says `npx` in a repository that forbids npm is a hook the
 * repository has to rewrite before it can trust it.
 * @param {string} repoDir @returns {PackageManager}
 */
export function managerFor(repoDir: string): PackageManager;
/**
 * A command written for npm (`npm run x`, `npm test`, `npx tool ...`) in another manager's words;
 * anything else unchanged.
 * @param {string} text @param {PackageManager} pm
 */
export function commandFor(text: string, pm: PackageManager): string;
export type PackageManagerId = "npm" | "pnpm" | "yarn" | "bun";
export type PackageManager = {
    id: PackageManagerId;
    lockfile: string;
    install: string[];
    run: (script: string, args?: string[]) => string[];
    exec: (tool: string) => string[];
    audit: ((level: string) => {
        check: string[];
        json: string[];
        byJson?: boolean;
    }) | null;
    auditCommand: string;
};
