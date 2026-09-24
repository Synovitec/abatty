/**
 * The `hooks` command, which `hooks:install` runs on every clone: git reads the hooks from
 * `.githooks`, and each of them, with the shim's wrappers, is executable on this machine. The bit
 * was once staged by `init` so a hook committed from Windows would not arrive 644 elsewhere, and
 * in a repository several sessions share, the next commit of any of them swept those staged files
 * in. Setting the bit where the hooks are installed holds on every machine without staging
 * anything: a clone that has not run this has no hooks path either.
 */
import { chmodSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SHIM_DIR, SHIM_FILES } from "../core/shim.mjs";
import { hooksNotExecutable, indexExecutable } from "../core/git-hooks.mjs";
import { EXIT } from "./exit.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} cx @returns {number} */
export function hooksCommand(cx) {
  const { dir, out, err } = cx;
  const set = spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: dir });
  if (set.status !== 0) {
    err(`${t.glyph.fail} not a git repository here: git config core.hooksPath could not be set\n`);
    return EXIT.error;
  }
  const hooks = existsSync(join(dir, ".githooks"))
    ? readdirSync(join(dir, ".githooks")).map((f) => join(".githooks", f))
    : [];
  const shims = SHIM_FILES.filter((f) => f !== "shim.mjs").map((f) => join(SHIM_DIR, f));
  const files = [...hooks, ...shims].filter((f) => existsSync(join(dir, f)));
  for (const f of files) {
    try {
      chmodSync(join(dir, f), 0o755);
    } catch {
      /* a filesystem without modes: git on it runs a hook without the bit */
    }
  }
  // The bit on disk is this machine's; git records its own, and a hook committed from a machine
  // without modes arrives 100644 on every other one, where git skips it without a word. A hook
  // already tracked that way gets the bit in the index too, which is a change to commit. One not
  // yet tracked is left alone: nothing is staged that the repository did not already carry.
  const inert = hooksNotExecutable(dir);
  const marked = indexExecutable(dir, inert);
  out(
    `${t.glyph.ok} hooks installed: core.hooksPath=.githooks · ${files.length} file(s) executable\n`,
  );
  if (marked.length)
    out(
      `${t.glyph.warn} ${marked.join(", ")} ${marked.length > 1 ? "were" : "was"} committed as not executable; the mode alone is staged now: commit it\n`,
    );
  const failed = inert.filter((f) => !marked.includes(f));
  if (failed.length) {
    err(
      `${t.glyph.fail} ${failed.join(", ")}: git would not take the executable mode (git update-index --cacheinfo)\n`,
    );
    return EXIT.error;
  }
  return EXIT.clean;
}
