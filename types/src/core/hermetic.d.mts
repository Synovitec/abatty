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
