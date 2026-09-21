/**
 * The package manager of a repository, or null when nothing it committed names one: no
 * `packageManager` field and no lockfile.
 * @param {string} repoDir @returns {PackageManager | null}
 */
export function packageManager(repoDir: string): PackageManager | null;
export type PackageManagerId = "npm" | "pnpm" | "yarn" | "bun";
export type PackageManager = {
    id: PackageManagerId;
    lockfile: string;
    install: string[];
    run: (script: string) => string[];
    exec: (tool: string) => string[];
    audit: ((level: string) => {
        check: string[];
        json: string[];
    }) | null;
    auditCommand: string;
};
