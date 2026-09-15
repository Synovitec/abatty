/**
 * Presets per workspace, composed. A monorepo is several stacks in one tree: `apps/web` a
 * Next app, `services/api` a Node service, `packages/db` a library. Each workspace with a
 * package of its own is detected from its own dependencies (or named in the config →
 * `workspaces`), gated in its own folder by its own preset's steps, while the rules and the
 * repository-level steps (the secret scan, the audit, the ratchet) run once at the root.
 * The root's `workspaces` field (npm, yarn) or a pnpm workspace file names the folders;
 * `apps/*`, `packages/*` and `services/*` are read when neither does.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { dependencyNames, readPackage } from "../core/repo.mjs";
import { detectPreset, presetById } from "./index.mjs";

/**
 * @typedef {{ path: string, name: string, presetId: string, preset: import("./index.mjs").Preset | null, from: "config" | "deps" | "none" }} Workspace
 */

/** The folder globs a repository names, or the conventional ones. @param {string} repoDir */
export function workspaceGlobs(repoDir) {
  const pkg = readPackage(repoDir);
  const ws = /** @type {any} */ (pkg.workspaces);
  const fromPkg = Array.isArray(ws) ? ws : ws && Array.isArray(ws.packages) ? ws.packages : null;
  if (fromPkg) return fromPkg.map(String);
  const pnpm = join(repoDir, "pnpm-workspace.yaml");
  if (existsSync(pnpm)) {
    const globs = [];
    for (const line of readFileSync(pnpm, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*-\s*["']?([^"'#\s]+)/);
      if (m) globs.push(m[1]);
    }
    if (globs.length) return globs;
  }
  return ["apps/*", "packages/*", "services/*"];
}

/** The folders a glob list names that carry a package.json, repository-relative. @param {string} repoDir @param {string[]} globs */
export function workspaceFolders(repoDir, globs) {
  /** @type {string[]} */
  const out = [];
  for (const g of globs) {
    const clean = g.replace(/\/+$/, "");
    if (clean.endsWith("/*")) {
      const parent = join(repoDir, clean.slice(0, -2));
      if (!existsSync(parent) || !statSync(parent).isDirectory()) continue;
      for (const name of readdirSync(parent).sort())
        if (existsSync(join(parent, name, "package.json")))
          out.push(`${clean.slice(0, -2)}/${name}`);
    } else if (!clean.includes("*") && existsSync(join(repoDir, clean, "package.json")))
      out.push(clean);
  }
  return [...new Set(out)];
}

/**
 * The workspaces of a repository with their presets: the config's naming wins, else the
 * detection from the workspace's own dependencies, else none (listed, not gated).
 * @param {string} repoDir @param {any} config
 * @returns {Workspace[]}
 */
export function detectWorkspaces(repoDir, config) {
  const named =
    config?.workspaces && typeof config.workspaces === "object" ? config.workspaces : {};
  return workspaceFolders(repoDir, workspaceGlobs(repoDir)).map((path) => {
    const dir = join(repoDir, path);
    const name = String(readPackage(dir).name || path);
    const wanted = named[path] ? String(named[path]) : "";
    const preset = wanted ? presetById(wanted) : detectPreset(dependencyNames(dir));
    return {
      path,
      name,
      presetId: preset ? preset.id : wanted || "",
      preset,
      from: wanted ? "config" : preset ? "deps" : "none",
    };
  });
}
