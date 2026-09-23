/**
 * Whether the program a package script starts can be found at all. cmd.exe answers a missing
 * tool with exit 1, the same code a tool that ran and judged the work returns, so on Windows the
 * gate reported "lint failed" for a repository that had never installed eslint. POSIX shells say
 * 127 and need none of this. The question is asked only after a script exited 1 on Windows, and
 * only a program that is found nowhere turns the answer into "not installed": a builtin, a path
 * or anything this cannot read keeps the tool's own verdict.
 */
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { readPackage } from "./repo.mjs";

/** cmd.exe's own commands: never on PATH, always there. */
const BUILTINS = new Set(
  "assoc break call cd chdir cls color copy date del dir echo endlocal erase exit for ftype goto if md mkdir mklink move path pause popd prompt pushd rd rem ren rename rmdir set setlocal shift start time title type ver verify vol".split(
    " ",
  ),
);

/**
 * The program a script's text starts: its first word, past `NAME=value` assignments. Null when
 * the first word is not a bare name (a path, a quote, a subshell), since then the shell's reading
 * is the only reading and this one would be a guess.
 * @param {string} text @returns {string | null}
 */
export function scriptProgram(text) {
  const words = String(text).trim().split(/\s+/);
  const first = words.find((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  return first && /^[A-Za-z0-9._@+-]+$/.test(first) ? first : null;
}

/**
 * Is `name` a program the shell would find from `dir`: a builtin, a `node_modules/.bin` entry in
 * the directory or any parent (where npm puts a workspace's tools), or a file on PATH with one of
 * PATHEXT's extensions.
 * @param {string} dir @param {string} name @param {NodeJS.ProcessEnv} [env]
 */
export function toolFound(dir, name, env = process.env) {
  if (BUILTINS.has(name.toLowerCase())) return true;
  const exts = [
    "",
    ...String(env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .filter(Boolean),
  ];
  const bins = [];
  for (let d = dir; ; d = dirname(d)) {
    bins.push(join(d, "node_modules", ".bin"));
    if (dirname(d) === d) break;
  }
  const path = String(env.PATH ?? env.Path ?? "")
    .split(delimiter)
    .filter(Boolean);
  return [...bins, ...path].some((b) => exts.some((e) => existsSync(join(b, name + e))));
}

/**
 * The missing program a script starts, or null: the script's text read from the repository's
 * package.json, its program looked up as the shell would.
 * @param {string} repoDir @param {string} script @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function missingTool(repoDir, script, env = process.env) {
  const text = readPackage(repoDir).scripts?.[script];
  const program = typeof text === "string" ? scriptProgram(text) : null;
  return program && !toolFound(repoDir, program, env) ? program : null;
}
