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
  cpSync,
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
import { CONTROLS_LOGS, runStepControls } from "./step-controls.mjs";
import { workspaceFolders, workspaceGlobs } from "../presets/workspaces.mjs";

/** The folders whose dependencies the copy links: the root's, and each workspace's. @param {string} repoDir */
function moduleHomes(repoDir) {
  return ["", ...workspaceFolders(repoDir, workspaceGlobs(repoDir))].filter((d) =>
    existsSync(join(repoDir, d, "node_modules")),
  );
}

/**
 * The repository's files as git sees them now, copied into a fresh folder that is a repository
 * of its own (the secret scan and some linters read git), its dependencies linked: the root's and
 * every workspace's. A monorepo whose workspaces keep their own node_modules had typecheck and
 * tests fail in the copy before anything was planted, and five working steps read as unproven.
 * @param {string} repoDir @returns {{ at: string, links: string[] }} the copy and the links in it
 */
function copyOf(repoDir) {
  const at = mkdtempSync(join(tmpdir(), "abatty-prove-"));
  const listed = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"],
    { cwd: repoDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  // NUL-separated (`-z`), so a path with a space or a quote in it is one path.
  for (const f of String(listed.stdout || "")
    .split(String.fromCharCode(0))
    .filter(Boolean)) {
    const from = join(repoDir, f);
    if (!existsSync(from) || lstatSync(from).isDirectory()) continue;
    mkdirSync(dirname(join(at, f)), { recursive: true });
    copyFileSync(from, join(at, f));
  }
  /** @type {string[]} */
  const links = [];
  for (const home of moduleHomes(repoDir)) {
    const link = join(at, home, "node_modules");
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(repoDir, home, "node_modules"), link, "junction");
    links.push(link);
  }
  const git = (/** @type {string[]} */ ...args) =>
    spawnSync("git", args, { cwd: at, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  return { at, links };
}

/**
 * Remove the copy: every dependency link is unlinked on its own before anything is removed
 * recursively, so a removal that followed a link could not empty the repository's own. A link
 * that would not go leaves the copy where it is rather than recursing into it.
 * @param {{ at: string, links: string[] }} copy
 */
function removeCopy(copy) {
  for (const link of copy.links) {
    try {
      if (lstatSync(link).isSymbolicLink()) unlinkSync(link); // a junction reads as one on Windows
    } catch {
      /* already gone */
    }
    if (existsSync(link)) return;
  }
  rmSync(copy.at, { recursive: true, force: true });
}

/**
 * Keep what the controls printed, outside the repository, before the copy goes: a step that was
 * red before its plant named a log inside the copy, which was gone by the time it was read, and
 * the path read as one in the repository. The verdicts point at the kept folder.
 * @param {string} at the copy @param {ReturnType<typeof runStepControls>} r
 */
function keepLogs(at, r) {
  const from = join(at, CONTROLS_LOGS);
  if (!existsSync(from)) return r;
  const to = mkdtempSync(join(tmpdir(), "abatty-prove-logs-"));
  cpSync(from, to, { recursive: true });
  const steps = r.steps.map((s) => ({ ...s, detail: s.detail.split(CONTROLS_LOGS).join(to) }));
  return { ...r, steps, logs: to };
}

/**
 * Prove a repository's checks on a copy of it: each always-on gate step of the preset planted
 * with a violation and judged; `suites` adds the build, browser and database suites. What the
 * steps printed is kept outside the repository (`logs`).
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, suites?: boolean, log?: (line: string) => void }} o
 * @returns {ReturnType<typeof runStepControls> & { logs?: string }}
 */
export function prove(o) {
  const copy = copyOf(o.repoDir);
  try {
    const r = runStepControls({
      repoDir: copy.at,
      preset: o.preset,
      log: o.log,
      suites: Boolean(o.suites),
    });
    return keepLogs(copy.at, r);
  } finally {
    removeCopy(copy);
  }
}
