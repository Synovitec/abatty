/**
 * @typedef {{ metric: string, was: number, now: number, version: number, written: boolean, why: string }} Migrated
 */
/**
 * Rewrite the floors the baseline holds under an older definition of their probe.
 * @param {string} repoDir @param {{ dryRun?: boolean }} [o]
 * @returns {Promise<Migrated[]>}
 */
export function migrateRedefined(repoDir: string, o?: {
    dryRun?: boolean;
}): Promise<Migrated[]>;
export type Migrated = {
    metric: string;
    was: number;
    now: number;
    version: number;
    written: boolean;
    why: string;
};
