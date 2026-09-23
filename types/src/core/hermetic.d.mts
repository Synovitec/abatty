/**
 * The database every step of the gate runs with: TEST_DATABASE_URL, as DATABASE_URL, when one is
 * named, since its value is known to be the run's own; nothing otherwise. A step outside the
 * suites that reads DATABASE_URL (a dead-code tool loading the ORM's config) went red for a
 * developer who unset their own DATABASE_URL on the deferral's advice.
 * @param {{ url: string, test: string }} [db]
 * @returns {Record<string, string>}
 */
export function stepDatabase(db?: {
    url: string;
    test: string;
}): Record<string, string>;
/**
 * The database a suite may run against, read in the folders it runs from.
 * @param {string[]} dirs @param {{ ci?: boolean, db?: { url: string, test: string } }} [o]
 * @returns {SuiteDatabase}
 */
export function suiteDatabase(dirs: string[], o?: {
    ci?: boolean;
    db?: {
        url: string;
        test: string;
    };
}): SuiteDatabase;
/**
 * `env`: the variables the suite's steps run with, on top of this process's.
 */
export type SuiteDatabase = {
    ok: true;
    env: Record<string, string>;
} | {
    ok: false;
    reason: string;
};
