/**
 * The bypass layer outside the agent.
 *
 * `.claude/bin` goes on PATH before everything else, so this file is the `git` that a terminal, a
 * script, a CI step or another tool's subprocess finds first. The guard hook refuses a bypass
 * inside the agent's shell; every other shell on the machine had no layer at all, which made the
 * guard a property of one tool rather than of the repository.
 *
 * It reads the argv git was actually called with, so a quoted flag, a shell variable and an alias
 * all arrive here already expanded - the one thing a hook reading a command string cannot see.
 *
 * It refuses exactly what the guard always denies and nothing else. A shim that second-guesses
 * the rest of git is a shim people uninstall, and an uninstalled layer refuses nothing.
 * ABATTY_SHIM=off hands everything through, and says so on stderr: a silent escape hatch is
 * indistinguishable from a broken one.
 */
import { spawnSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The refusals, in the guard hook's own words: one bypass, one message, wherever it is tried. */
export const SHIM_REFUSALS = {
  "force-push": "Force push is never allowed. Rebase onto the remote or make a new commit.",
  "no-verify": "Hook bypass (--no-verify) is not a workflow. Make the gate pass instead.",
  "hooks-path":
    "Pointing core.hooksPath elsewhere, or unsetting it, skips the hooks exactly as --no-verify does. Make the gate pass instead; reinstall the hooks with the package's hooks command.",
};

const HOOKS_KEY = /^core\.hookspath\b/i;

/**
 * Whether this call points the hooks away, by its arguments or its environment: `-c` and
 * `--config-env` for one call, a `config` write for good, `GIT_CONFIG_KEY_n` or
 * `GIT_CONFIG_PARAMETERS` naming the key. The same bypass as the flag, by its effect; reading
 * the key is not a write.
 * @param {string[]} args @param {string} name @param {string[]} rest @param {Record<string, string | undefined>} env
 */
function pointsHooksAway(args, name, rest, env) {
  const global = args.slice(0, args.length - rest.length - (name ? 1 : 0));
  if (
    global.some(
      (a, i) =>
        (/^(-c|--config-env)$/.test(global[i - 1] || "") && HOOKS_KEY.test(a)) ||
        /^--config-env=core\.hookspath/i.test(a),
    )
  )
    return true;
  if (name === "config") {
    const at = rest.findIndex((a) => HOOKS_KEY.test(a));
    const reads = rest.some((a) => /^(--get(-all|-regexp)?|--list|-l|get|list)$/.test(a));
    const verb = rest.some((a) => /^(--unset(-all)?|--add|--replace-all|set|unset)$/.test(a));
    if (at >= 0 && !reads && (verb || rest.length > at + 1)) return true;
  }
  return Object.entries(env).some(
    ([k, v]) =>
      (/^GIT_CONFIG_KEY_\d+$/.test(k) && HOOKS_KEY.test(v || "")) ||
      (k === "GIT_CONFIG_PARAMETERS" && /core\.hookspath/i.test(v || "")),
  );
}

/** git's global options that swallow the next argument, so a subcommand is not mistaken for one. */
const GLOBAL_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--config-env",
  "--exec-path",
]);

/** Options whose value is free text: a commit message reading "-n" is a message, not a flag. */
const VALUE_AFTER = new Set([
  "-m",
  "--message",
  "-F",
  "--file",
  "-c",
  "-C",
  "--author",
  "--date",
  "--fixup",
  "--squash",
]);

/**
 * The subcommand and what follows it. WHY a scanner and not `args[0]`: `git -C dir push` is a
 * push, and a layer that one global option walks past is not a layer.
 * @param {string[]} args
 * @returns {{ name: string, rest: string[] }}
 */
export function subcommandOf(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (!a.startsWith("-")) return { name: a, rest: args.slice(i + 1) };
    if (GLOBAL_WITH_VALUE.has(a)) i++;
  }
  return { name: "", rest: [] };
}

/** The flags of a subcommand: the value of an option that takes one is not a flag. @param {string[]} rest */
function flagsOf(rest) {
  /** @type {string[]} */
  const flags = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? "";
    if (a === "--") break;
    if (VALUE_AFTER.has(a)) i++;
    else if (a.startsWith("-")) flags.push(a);
  }
  return flags;
}

/**
 * What this call is refused for, or null when it is ordinary work. The short-flag cluster is
 * checked because `git commit -am` exists and so does the bypass bundled into one.
 * @param {string[]} args the arguments git was called with, without the program name
 * @param {Record<string, string | undefined>} [env] the environment git would run in
 * @returns {{ id: string, reason: string } | null}
 */
export function shimVerdict(args, env = process.env) {
  const { name, rest } = subcommandOf(args);
  const flags = flagsOf(rest);
  const refuse = (/** @type {"force-push" | "no-verify" | "hooks-path"} */ id) => ({
    id,
    reason: SHIM_REFUSALS[id],
  });
  if (pointsHooksAway(args, name, rest, env)) return refuse("hooks-path");
  if (flags.includes("--no-verify")) return refuse("no-verify");
  if (name === "commit" && flags.some((f) => /^-[a-zA-Z]*n/.test(f))) return refuse("no-verify");
  if (name === "push") {
    if (flags.some((f) => f === "-f" || /^--force(-with-lease|-if-includes)?(=|$)/.test(f)))
      return refuse("force-push");
    if (rest.some((a) => /^\+\S/.test(a))) return refuse("force-push");
  }
  return null;
}

/** Whether a path is a file this process may execute. @param {string} p */
function executable(p) {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The git this shim stands in front of: the first one on PATH outside the shim's own directory.
 * WHY compared by resolved path and not by name: a shim that finds itself spawns itself forever.
 * @param {string} selfDir
 * @param {string} pathEnv
 * @param {(p: string) => boolean} [isExe]
 * @returns {string | null}
 */
export function realGit(selfDir, pathEnv, isExe = executable) {
  // On Windows a file named `git` with no extension is not something the OS can run, and a
  // shell script by that name (what a POSIX PATH carries) would only fail at spawn time.
  const names = process.platform === "win32" ? ["git.exe", "git.cmd"] : ["git"];
  for (const dir of String(pathEnv || "").split(delimiter)) {
    if (!dir || resolve(dir) === resolve(selfDir)) continue;
    for (const n of names) if (isExe(join(dir, n))) return join(dir, n);
  }
  return null;
}

/**
 * An argument as cmd.exe will hand it on unchanged, for the one case a shell is needed: a git
 * that is itself a batch file, which Node refuses to spawn without one (EINVAL since 20.12).
 * @param {string} a
 */
const quoteForCmd = (a) => (/[\s"&|<>^()]/.test(a) || a === "" ? `"${a.replace(/"/g, '\\"')}"` : a);

/**
 * The shim as it runs: refuse, or hand the call to the real git and carry its exit code back.
 * 3 is a refusal and 4 an instrument error, the same two codes the CLI uses, so a script can tell
 * "this was refused" from "the shim itself is broken" without reading the message.
 * @param {string[]} args
 * @param {string} [selfDir]
 * @returns {number}
 */
export function runShim(args, selfDir = dirname(fileURLToPath(import.meta.url))) {
  if (process.env.ABATTY_SHIM === "off") {
    process.stderr.write("abatty: the git shim is off (ABATTY_SHIM=off); nothing is refused.\n");
  } else {
    const v = shimVerdict(args);
    if (v) {
      process.stderr.write(`abatty: ${v.reason}\n`);
      return 3;
    }
  }
  const real = realGit(selfDir, process.env.PATH || "");
  if (!real) {
    process.stderr.write("abatty: the git shim found no git on PATH outside its own folder.\n");
    return 4;
  }
  const batch = /\.(cmd|bat)$/i.test(real);
  const r = batch
    ? spawnSync(`"${real}"`, args.map(quoteForCmd), { stdio: "inherit", shell: true })
    : spawnSync(real, args, { stdio: "inherit" });
  return r.status ?? (r.signal ? 128 : 4);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(runShim(process.argv.slice(2)));
