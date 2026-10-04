/**
 * The scripts whose tool is not among a package's dependencies, and the sentence that names them
 * with the install each waits for ("" when none).
 * @param {[string, string][]} scripts name and command
 * @param {Record<string, unknown>} deps the package's dependencies and devDependencies
 * @returns {{ waiting: [string, string][], says: string }}
 */
export function scriptsWaitingForTools(scripts: [string, string][], deps: Record<string, unknown>): {
    waiting: [string, string][];
    says: string;
};
