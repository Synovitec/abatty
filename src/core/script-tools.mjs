/**
 * Which package a preset's script needs installed to run, read from the command it calls. `update`
 * installs nothing, and a `graph` or `dead` script it added with no dependency-cruiser or knip
 * made the next gate fail; the scripts whose tool is missing are left out and named instead.
 */

/** The package each tool a preset's scripts call comes from, by the command's name. */
const SCRIPT_TOOLS = {
  depcruise: "dependency-cruiser",
  knip: "knip",
  eslint: "eslint",
  tsc: "typescript",
  prettier: "prettier",
  vitest: "vitest",
};

/** The package a script's command needs, or "" for one it does not know. @param {string} command */
function toolOf(command) {
  return (
    Object.entries(SCRIPT_TOOLS).find(([bin]) => new RegExp(`\\b${bin}\\b`).test(command))?.[1] ||
    ""
  );
}

/**
 * The scripts whose tool is not among a package's dependencies, and the sentence that names them
 * with the install each waits for ("" when none).
 * @param {[string, string][]} scripts name and command
 * @param {Record<string, unknown>} deps the package's dependencies and devDependencies
 * @returns {{ waiting: [string, string][], says: string }}
 */
export function scriptsWaitingForTools(scripts, deps) {
  const waiting = scripts.filter(([, v]) => toolOf(v) && !deps[toolOf(v)]);
  if (!waiting.length) return { waiting, says: "" };
  const tools = [...new Set(waiting.map(([, v]) => toolOf(v)))];
  return {
    waiting,
    says: `not added, its tool not installed: ${waiting.map(([k]) => k).join(", ")} (install ${tools.join(", ")} as dev dependencies, then run update again)`,
  };
}
