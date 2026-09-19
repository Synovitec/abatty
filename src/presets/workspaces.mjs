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
    const preset = wanted
      ? presetById(wanted)
      : detectPreset(dependencyNames(dir), (re) => readdirSync(dir).filter((f) => re.test(f)));
    return {
      path,
      name,
      presetId: preset ? preset.id : wanted || "",
      preset,
      from: wanted ? "config" : preset ? "deps" : "none",
    };
  });
}

/**
 * Which workspace a repository-relative path belongs to, or null for the root.
 * @param {string} file @param {{ path: string }[]} workspaces
 */
function ownerOf(file, workspaces) {
  let best = null;
  for (const w of workspaces)
    if (file === w.path || file.startsWith(w.path + "/"))
      if (!best || w.path.length > best.path.length) best = w;
  return best;
}

/**
 * The internal dependency graph: per workspace, the workspaces it names in its own manifest.
 * A name that is not another workspace's name is a registry dependency and is not an edge.
 * The name is read from each workspace's own manifest rather than taken from the caller, so the
 * graph is correct for any caller that knows only the folders.
 * @param {string} repoDir @param {{ path: string }[]} workspaces
 * @returns {{ edges: Map<string, Set<string>>, read: number }} edges: dependent → dependencies
 */
export function workspaceGraph(repoDir, workspaces) {
  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const w of workspaces) {
    const name = readPackage(join(repoDir, w.path)).name;
    if (name) byName.set(String(name), w.path);
  }
  /** @type {Map<string, Set<string>>} */
  const edges = new Map();
  let read = 0;
  for (const w of workspaces) {
    const pkg = readPackage(join(repoDir, w.path));
    if (Object.keys(pkg).length) read++;
    const any = /** @type {Record<string, Record<string, string> | undefined>} */ (
      /** @type {unknown} */ (pkg)
    );
    const names = [
      ...Object.keys(any.dependencies || {}),
      ...Object.keys(any.devDependencies || {}),
      ...Object.keys(any.peerDependencies || {}),
      ...Object.keys(any.optionalDependencies || {}),
    ];
    /** @type {string[]} */
    const inside = [];
    for (const n of names) {
      const path = byName.get(n);
      if (path && path !== w.path) inside.push(path);
    }
    edges.set(w.path, new Set(inside));
  }
  return { edges, read };
}

/**
 * The workspaces a change reaches. Selection by path answers half the question: which inputs
 * changed. The other half is which workspaces can observe them, and a path filter cannot see it,
 * so a change under a shared package let the application that imports it through ungated. That
 * is a silent pass, which is the worst thing a gate can do, because nothing in the output says
 * the check did not happen.
 *
 * A workspace is selected when a changed file is under it, or when it depends, at any depth, on
 * a workspace that is. A changed file outside every workspace selects them all, and so does a
 * tree whose manifests could not be read: conservative and slow is a correct gate, fast and
 * silent is not, and the reason is returned so the output can say which of the two happened.
 * @param {string} repoDir @param {{ path: string }[]} workspaces @param {string[]} changed
 * @returns {{ selected: Set<string>, viaGraph: Map<string, string>, everything: string | null }}
 */
export function affectedWorkspaces(repoDir, workspaces, changed) {
  const paths = workspaces.map((w) => w.path);
  const all = () => new Set(paths);
  if (!workspaces.length) return { selected: new Set(), viaGraph: new Map(), everything: null };
  const { edges, read } = workspaceGraph(repoDir, workspaces);
  if (read < workspaces.length)
    return {
      selected: all(),
      viaGraph: new Map(),
      everything: "a workspace manifest could not be read, so every workspace is selected",
    };
  /** @type {Set<string>} */
  const direct = new Set();
  for (const f of changed) {
    const owner = ownerOf(f, workspaces);
    if (!owner)
      return {
        selected: all(),
        viaGraph: new Map(),
        everything: `${f} is outside every workspace, so every workspace is selected`,
      };
    direct.add(owner.path);
  }
  // Walk the edges the other way: a changed workspace selects everything that depends on it.
  const selected = new Set(direct);
  /** @type {Map<string, string>} */
  const viaGraph = new Map();
  for (let grew = true; grew;) {
    grew = false;
    for (const [dependent, deps] of edges)
      if (!selected.has(dependent))
        for (const d of deps)
          if (selected.has(d)) {
            selected.add(dependent);
            viaGraph.set(dependent, d);
            grew = true;
            break;
          }
  }
  return { selected, viaGraph, everything: null };
}
