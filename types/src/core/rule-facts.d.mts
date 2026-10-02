/**
 * The dependency names and the `stack:<fact>` entries true here.
 * @param {string} repoDir @returns {Set<string>}
 */
export function ruleFacts(repoDir: string): Set<string>;
/**
 * A need as a reader says it: a dependency by its name, a fact by what it is.
 * @param {string} need @returns {string}
 */
export function needLabel(need: string): string;
