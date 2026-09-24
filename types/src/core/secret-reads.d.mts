/**
 * The path globs of the `Read(...)` rules in a settings object's `permissions.deny`.
 * @param {any} settings @returns {string[]}
 */
export function readDenies(settings: any): string[];
/**
 * The secret names a settings object would let the agent read.
 * @param {any} settings @returns {string[]}
 */
export function unrefusedSecrets(settings: any): string[];
/**
 * The deny rules `shipped` carries that `installed` does not, and the allow rules `installed`
 * added: what a reader needs to see when a settings file differs from the template, named rather
 * than called drift.
 * @param {any} shipped @param {any} installed
 */
export function loosenedRules(shipped: any, installed: any): {
    removedDenies: string[];
    addedAllows: string[];
};
/**
 * Whether an agent's settings still refuse it the secret files, judged by what the deny rules
 * match rather than by how they are spelled. An adopter narrowed `Read(./.env.*)` to eight named
 * files so an allow for `.env.example` could work (a deny beats an allow); every daytime check
 * stayed green, because the rule looked for words and doctor called it drift, while
 * `.env.staging`, `.env.prod` and `.env.local.bak` became readable. The question is asked of
 * names planted for it: would these rules refuse a read of each?
 */
/**
 * The names a secret-read deny must cover: the env file, the spellings of its variants a
 * repository grows (a stage, a backup, a platform's pull), whether or not they exist today.
 */
export const SECRET_NAMES: string[];
