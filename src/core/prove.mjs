/**
 * `abatty prove`: which of a repository's checks can actually fail, with nothing written in it.
 * The controls (step-controls.mjs) plant a violation per gate step, run the step and judge it; run
 * on the repository itself they plant files there and keep their logs there. Here they run on a
 * copy: the tracked files and the untracked ones git does not ignore, as they are on disk now,
 * with the dependencies linked rather than copied. The copy is removed afterwards, the link first,
 * so the removal can never reach the repository's own node_modules. A stranger's first contact
 * with the tool (six outside reviews asked for one) needs no config, no init and no commit.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runStepControls } from "./step-controls.mjs";

/**
 * The repository's files as git sees them now, copied into a fresh folder that is a repository
 * of its own (the secret scan and some linters read git), its dependencies linked.
 * @param {string} repoDir @returns {string} the copy
 */
function copyOf(repoDir) {
  const at = mkdtempSync(join(tmpdir(), "abatty-prove-"));
  const listed = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"],
    { cwd: repoDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  for (const f of String(listed.stdout || "")
    .split("\0")
    .filter(Boolean)) {
    const from = join(repoDir, f);
    if (!existsSync(from) || lstatSync(from).isDirectory()) continue;
    mkdirSync(dirname(join(at, f)), { recursive: true });
    copyFileSync(from, join(at, f));
  }
  if (existsSync(join(repoDir, "node_modules")) && !existsSync(join(at, "node_modules")))
    symlinkSync(join(repoDir, "node_modules"), join(at, "node_modules"), "junction");
  const git = (/** @type {string[]} */ ...args) =>
    spawnSync("git", args, { cwd: at, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  return at;
}

/**
 * Remove the copy: the dependency link is unlinked on its own before anything is removed
 * recursively, so a removal that followed the link could not empty the repository's own.
 * @param {string} at
 */
function removeCopy(at) {
  const link = join(at, "node_modules");
  let linked = false;
  try {
    linked = lstatSync(link).isSymbolicLink(); // a junction reads as one on Windows
  } catch {
    /* no node_modules in the copy */
  }
  if (linked) {
    unlinkSync(link);
    // A link that would not go is left with the copy rather than recursed into.
    if (existsSync(link)) return;
  }
  rmSync(at, { recursive: true, force: true });
}

/**
 * Prove a repository's checks on a copy of it: each always-on gate step of the preset planted
 * with a violation and judged; `suites` adds the build, browser and database suites.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, suites?: boolean, log?: (line: string) => void }} o
 * @returns {ReturnType<typeof runStepControls>}
 */
export function prove(o) {
  const at = copyOf(o.repoDir);
  try {
    return runStepControls({
      repoDir: at,
      preset: o.preset,
      log: o.log,
      suites: Boolean(o.suites),
    });
  } finally {
    removeCopy(at);
  }
}
