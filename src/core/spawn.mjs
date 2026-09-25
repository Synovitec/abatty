import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { missingTool } from "./which.mjs";
import { childEnv, searchFromEnv } from "./env.mjs";

/**
 * How a command is spawned, in one place. `shell: true` was on every spawn site in this package,
 * and almost none of them needed it: each already passes a command and an argument array, so the
 * shell only added an interpretation layer between the two - one that re-parses quoting, differs
 * on Windows, and sits exactly where a repository's own scripts run during an unattended night.
 *
 * The one place a shell is load-bearing is a tool launcher on Windows. `npm`, `npx`, `pnpm`,
 * `yarn` and `bun` are batch files there, and a batch file is a script for cmd.exe: since 20.12
 * Node refuses to spawn one without a shell (EINVAL, the fix for CVE-2024-27980), because there
 * is no way to hand a batch file its arguments that cmd.exe will not re-parse. Naming the
 * launcher was tried first and is what turned this package's own gate red on Windows for two
 * days ("format could not run: EINVAL"). So a launcher on Windows gets the shell, and its
 * arguments are quoted for that shell here, once; nothing else gets one.
 */

/** Node's tool launchers are batch files on Windows, where the bare name does not resolve. */
const LAUNCHERS = /^(npm|npx|yarn|pnpm|bun)$/;

/** @typedef {{ file: string, args: string[], shell: boolean }} Launch */

/**
 * An argument as cmd.exe will hand it on unchanged: quoted when it carries whitespace, a quote
 * or a character the shell would otherwise read (`& | < > ^ ( )`), the quotes inside escaped
 * the way the receiving program's argv parser expects. `%NAME%` is still expanded inside quotes
 * by cmd.exe; no argument this package builds carries one.
 * @param {string} a
 */
export const quoteForCmd = (a) =>
  /[\s"&|<>^()]/.test(a) || a === "" ? `"${a.replace(/"/g, '\\"')}"` : a;

/**
 * The executable, the arguments and whether a shell sits between them, for a command name:
 * unchanged everywhere but Windows, where a tool launcher becomes `<name>.cmd` under cmd.exe
 * with the arguments quoted for it.
 * @param {string} command @param {string[]} [args] @returns {Launch}
 */
export function launch(command, args = []) {
  if (process.platform !== "win32" || !LAUNCHERS.test(command))
    return { file: command, args, shell: false };
  return { file: `${command}.cmd`, args: args.map(quoteForCmd), shell: true };
}

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
  // POSIX shells answer a missing or unrunnable tool with 127 and 126. cmd.exe answers both with
  // 1, the same code a tool that ran and failed returns; runScript asks which it was.
  if (r.status === 127) return { code: 127, errored: true, detail: "command not found" };
  if (r.status === 126) return { code: 126, errored: true, detail: "command not executable" };
  return { code: r.status ?? 1 };
}

/** A runner may answer with a bare exit code; read it as one that ran. @param {RunResult | number} r @returns {RunResult} */
export const asResult = (r) => (typeof r === "number" ? { code: r } : r);

/**
 * Run an npm script and say how it went; output goes straight to the terminal. `env` is laid
 * over this process's environment: how a suite is given a database of its own.
 * With `o.log`, the output is also kept in that file (src/core/tee-step.mjs), still shown live.
 * @param {string} repoDir @param {string} script @param {string[]} [extraArgs]
 * @param {Record<string, string>} [env] @param {{ log?: string }} [o] @returns {RunResult}
 */
export function runScript(repoDir, script, extraArgs = [], env = {}, o = {}) {
  const l = launch("npm", ["run", "-s", script, ...(extraArgs.length ? ["--", ...extraArgs] : [])]);
  const res = resultOf(
    o.log
      ? spawnSync(process.execPath, [TEE, o.log, l.shell ? "1" : "0", l.file, ...l.args], {
          cwd: repoDir,
          stdio: "inherit",
          env: childEnv(env),
        })
      : spawnSync(l.file, l.args, {
          cwd: repoDir,
          stdio: "inherit",
          shell: l.shell,
          env: childEnv(env),
        }),
  );
  return notInstalled(res, repoDir, script);
}

/** The step wrapper that shows a step's output and keeps it. */
const TEE = fileURLToPath(new URL("./tee-step.mjs", import.meta.url));

/**
 * A script that exited 1 on Windows, read again: when its program is found nowhere, cmd.exe's 1
 * meant "not recognized", and the step could not run rather than failed.
 * @param {RunResult} res @param {string} repoDir @param {string} script
 * @param {string} [platform] @param {NodeJS.ProcessEnv} [env] @returns {RunResult}
 */
export function notInstalled(
  res,
  repoDir,
  script,
  platform = process.platform,
  env = searchFromEnv(),
) {
  if (platform !== "win32" || res.code !== 1 || res.errored) return res;
  const tool = missingTool(repoDir, script, env);
  return tool
    ? { code: 127, errored: true, detail: `${tool}: not installed (cmd.exe said 1)` }
    : res;
}

/** Run a command as given; output goes straight to the terminal. @param {string} repoDir @param {string[]} argv @returns {RunResult} */
export function runCommand(repoDir, argv) {
  const [cmd, ...args] = argv;
  const l = launch(String(cmd), args);
  return resultOf(spawnSync(l.file, l.args, { cwd: repoDir, stdio: "inherit", shell: l.shell }));
}

export function dockerRunning() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}
