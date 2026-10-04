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

/** The NUL-separated paths a git listing gives (`-z`), so a path with a space is one path. @param {string} repoDir @param {string[]} args */
function listed(repoDir, args) {
  const r = spawnSync("git", ["ls-files", "-z", ...args], {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return String(r.stdout || "")
    .split(String.fromCharCode(0))
    .filter(Boolean);
}

/**
 * The repository as it is now, in a fresh folder: a clone sharing its objects (nothing copied,
 * nothing written in the source), at the same commit and branch, with the remote-tracking refs it
 * has, so a step that reads history or a push range reads the same one; then the working tree's
 * own changes laid over it, the dependencies linked (the root's and every workspace's), and the
 * env files git ignores linked too. A copy built from the files alone, with a history of one
 * commit, read a monorepo's coverage, ratchet and tests red before anything was planted.
 * @param {string} repoDir @returns {{ at: string, links: string[] }} the copy and the links in it
 */
function copyOf(repoDir) {
  const at = mkdtempSync(join(tmpdir(), "abatty-prove-"));
  const git = (/** @type {string} */ cwd, /** @type {string[]} */ ...args) =>
    spawnSync("git", args, { cwd, encoding: "utf8" });
  const head = String(git(repoDir, "rev-parse", "HEAD").stdout || "").trim();
  const branch = String(git(repoDir, "rev-parse", "--abbrev-ref", "HEAD").stdout || "").trim();
  git(tmpdir(), "clone", "-q", "--shared", "--no-checkout", repoDir, at);
  git(at, "fetch", "-q", repoDir, "+refs/remotes/origin/*:refs/remotes/origin/*");
  if (head)
    branch && branch !== "HEAD"
      ? git(at, "checkout", "-q", "-B", branch, head)
      : git(at, "checkout", "-q", "--detach", head);
  const upstream = String(git(repoDir, "rev-parse", "--abbrev-ref", "@{u}").stdout || "").trim();
  if (upstream.startsWith("origin/")) git(at, "branch", "-q", `--set-upstream-to=${upstream}`);
  // The working tree's own state over the commit: what is changed or new, and what is gone.
  for (const f of listed(repoDir, ["--modified", "--others", "--exclude-standard"])) {
    const from = join(repoDir, f);
    if (!existsSync(from) || lstatSync(from).isDirectory()) continue;
    mkdirSync(dirname(join(at, f)), { recursive: true });
    copyFileSync(from, join(at, f));
  }
  for (const f of listed(repoDir, ["--deleted"])) rmSync(join(at, f), { force: true });
  /** @type {string[]} */
  const links = [];
  for (const home of moduleHomes(repoDir)) {
    const link = join(at, home, "node_modules");
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(repoDir, home, "node_modules"), link, "junction");
    links.push(link);
  }
  // The env files the repository keeps out of git and its steps read: linked, not copied, so
  // no secret is duplicated, and unlinked before the copy goes. A test reading DATABASE_URL from
  // one fell back to a default in the copy and read red before its plant.
  const ignored = ["--others", "--ignored", "--exclude-standard", "--directory"];
  for (const f of listed(repoDir, ignored).filter((p) => /(?:^|\/)\.env[^/]*$/.test(p))) {
    const link = join(at, f);
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    try {
      symlinkSync(join(repoDir, f), link, "file");
    } catch {
      // A machine that refuses file links (Windows without the privilege) gets a copy, which
      // goes with the folder.
      copyFileSync(join(repoDir, f), link);
      continue;
    }
    links.push(link);
  }
  // What the repository generated and keeps out of git (a Prisma client under generated/, an
  // API client, codegen output): copied, not linked, since a step may regenerate it and must not
  // write into the repository through a link. Without it, a Next and Prisma product read its
  // typecheck and tests red before any plant. Dependencies, builds and caches are not sources.
  for (const d of listed(repoDir, ignored).filter((p) => p.endsWith("/") && !NOT_SOURCES.test(p))) {
    const to = join(at, d);
    if (existsSync(to)) continue;
    cpSync(join(repoDir, d), to, {
      recursive: true,
      filter: (from) => !/[/\\]node_modules(?:[/\\]|$)/.test(from.slice(repoDir.length)),
    });
  }
  return { at, links };
}

/**
 * The ignored folders that are not the repository's own generated sources: dependencies, build
 * outputs, caches, reports and abatty's own records. They are linked (node_modules), rebuilt by
 * the steps, or not read by them, and copying them would copy gigabytes.
 */
const NOT_SOURCES =
  /(?:^|\/)(?:node_modules|\.git|\.next|\.nuxt|\.svelte-kit|\.astro|\.turbo|\.cache|\.parcel-cache|\.vercel|\.output|\.abatty|dist|build|out|coverage|target|\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|playwright-report|test-results|storybook-static|\.idea|\.vscode)\/$/;

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
