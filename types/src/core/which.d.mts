/**
 * The program a script's text starts: its first word, past `NAME=value` assignments. Null when
 * the first word is not a bare name (a path, a quote, a subshell), since then the shell's reading
 * is the only reading and this one would be a guess.
 * @param {string} text @returns {string | null}
 */
export function scriptProgram(text: string): string | null;
/**
 * Is `name` a program the shell would find from `dir`: a builtin, a `node_modules/.bin` entry in
 * the directory or any parent (where npm puts a workspace's tools), or a file on PATH with one of
 * PATHEXT's extensions. Under Plug'n'Play there is no `.bin` to read and the package manager
 * resolves the tool itself, so a tree with a `.pnp.cjs` answers yes rather than guess.
 * @param {string} dir @param {string} name @param {NodeJS.ProcessEnv} [env]
 */
export function toolFound(dir: string, name: string, env?: NodeJS.ProcessEnv): boolean;
/**
 * The missing program a script starts, or null: the script's text read from the repository's
 * package.json, its program looked up as the shell would.
 * @param {string} repoDir @param {string} script @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function missingTool(repoDir: string, script: string, env?: NodeJS.ProcessEnv): string | null;
