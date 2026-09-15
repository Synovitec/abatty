/** The schema as the package ships it. @returns {any} */
export function schema(): any;
/** Which config files the repository has. @param {string} repoDir */
export function configFiles(repoDir: string): string[];
/**
 * Validate a value against the subset of JSON Schema the package's schema uses: type (with
 * arrays of types), properties, additionalProperties (false or a schema), patternProperties,
 * required, items, enum, minimum, maximum. Returns the problems as "path: what".
 * @param {any} value @param {any} [sch] @param {string} [path]
 * @returns {string[]}
 */
export function validateConfig(value: any, sch?: any, path?: string): string[];
/** The problems of the repository's config files, each validated on its own. @param {string} repoDir */
export function configProblems(repoDir: string): string[];
/**
 * Move `.claude/adoption.json` to the root as `abatty.config.json` (merged over an existing root
 * file, the root's values winning), with the `$schema` line. Returns what happened.
 * @param {string} repoDir @param {{ dryRun?: boolean }} [o]
 */
export function migrateConfig(repoDir: string, o?: {
    dryRun?: boolean;
}): {
    moved: boolean;
    reason: string;
};
export const SCHEMA_URL: "https://abatty.io/schema/abatty.config.json";
export const SCHEMA_PATH: string;
import { CONFIG_FILE } from "./repo.mjs";
import { LEGACY_CONFIG } from "./repo.mjs";
import { readConfig } from "./repo.mjs";
export { CONFIG_FILE, LEGACY_CONFIG, readConfig };
