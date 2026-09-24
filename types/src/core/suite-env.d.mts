/**
 * The names the example env file declares that neither this shell, a dotenv file the framework
 * loads, nor the config's `suiteEnv` supplies, read in the folders a suite runs from. Empty in CI,
 * whose workflow is where a pipeline's environment is written.
 * @param {string[]} dirs @param {{ ci?: boolean, declared?: Record<string, string> }} [o]
 * @returns {string[]}
 */
export function suiteEnvGaps(dirs: string[], o?: {
    ci?: boolean;
    declared?: Record<string, string>;
}): string[];
/**
 * The config's `suiteEnv`: non-secret values a suite runs with, as a pipeline's workflow gives
 * them. A value that is not a string is left out rather than coerced.
 * @param {string} repoDir @returns {Record<string, string>}
 */
export function suiteEnvOf(repoDir: string): Record<string, string>;
