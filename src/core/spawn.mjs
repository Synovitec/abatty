import { spawnSync } from "node:child_process";

/**
 * How a command is spawned, in one place. `shell: true` was on every spawn site in this package,
 * and almost none of them needed it: each already passes a command and an argument array, so the
 * shell only added an interpretation layer between the two - one that re-parses quoting, differs
 * on Windows, and sits exactly where a repository's own scripts run during an unattended night.
 *
 * What the shell was actually covering is narrower: on Windows the node tool launchers are batch
 * files, and `npm` alone does not resolve. Naming the launcher does the same job without handing
 * the arguments to a parser.
 */

/** Node's tool launchers are batch files on Windows, where the bare name does not resolve. */
const LAUNCHERS = /^(npm|npx|yarn|pnpm|bun)$/;

/**
 * The executable to spawn for a command name: unchanged everywhere but Windows, where a tool
 * launcher gets the `.cmd` that makes it resolvable without a shell.
 * @param {string} command
 */
export const bin = (command) =>
  process.platform === "win32" && LAUNCHERS.test(command) ? `${command}.cmd` : command;

/**
 * @typedef {{ code: number, errored?: boolean, detail?: string }} RunResult
 */

/**
 * Did the tool run and report, or did it never get to report? A tool that exits non-zero has
 * judged the work; a tool that could not be spawned, was killed by a signal, or that the shell
 * could not find or execute has judged nothing, and calling that a failure tells the reader
 * their work is bad when the instrument is what broke.
 * @param {import("node:child_process").SpawnSyncReturns<string | Buffer>} r @returns {RunResult}
 */
function resultOf(r) {
  if (r.error)
    return {
      code: r.status ?? 1,
      errored: true,
      detail: /** @type {NodeJS.ErrnoException} */ (r.error).code
        ? `${/** @type {NodeJS.ErrnoException} */ (r.error).code}: ${r.error.message}`
        : r.error.message,
    };
  if (r.signal) return { code: 1, errored: true, detail: `killed by ${r.signal}` };
  if (r.status === 127) return { code: 127, errored: true, detail: "command not found" };
  if (r.status === 126) return { code: 126, errored: true, detail: "command not executable" };
  return { code: r.status ?? 1 };
}

/** A runner may answer with a bare exit code; read it as one that ran. @param {RunResult | number} r @returns {RunResult} */
export const asResult = (r) => (typeof r === "number" ? { code: r } : r);

/**
 * Run an npm script and say how it went; output goes straight to the terminal.
 * @param {string} repoDir @param {string} script @param {string[]} [extraArgs] @returns {RunResult}
 */
export function runScript(repoDir, script, extraArgs = []) {
  return resultOf(
    spawnSync(
      bin("npm"),
      ["run", "-s", script, ...(extraArgs.length ? ["--", ...extraArgs] : [])],
      {
        cwd: repoDir,
        stdio: "inherit",
      },
    ),
  );
}

/** Run a command as given; output goes straight to the terminal. @param {string} repoDir @param {string[]} argv @returns {RunResult} */
export function runCommand(repoDir, argv) {
  const [cmd, ...args] = argv;
  return resultOf(spawnSync(bin(String(cmd)), args, { cwd: repoDir, stdio: "inherit" }));
}

export function dockerRunning() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}
