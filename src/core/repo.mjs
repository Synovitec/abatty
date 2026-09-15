/**
 * The repository a command works on: its root, its package.json, its adoption.json (the one
 * config the hooks already trust), and the small file helpers every command shares.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** JSON.parse that tolerates a UTF-8 BOM (Windows PowerShell 5.1 writes one). @param {string} text */
export function parseJson(text) {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

/** @param {string} dir @param {string} rel */
export function readJsonFile(dir, rel) {
  const p = join(dir, rel);
  return existsSync(p) ? parseJson(readFileSync(p, "utf8")) : null;
}

/** Writes JSON without a BOM, LF, trailing newline - the way the hooks read it back. @param {string} dir @param {string} rel @param {unknown} value */
export function writeJsonFile(dir, rel, value) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
}

/** Run git in a directory; "" when it fails - a command must never crash on git. @param {string} dir @param {string[]} args */
export function git(dir, ...args) {
  const r = spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

/**
 * The repository root: the nearest ancestor with a .git or a package.json, or the directory
 * itself. A command run from a subfolder still works on the whole repository.
 * @param {string} [dir]
 */
export function repoRoot(dir = process.cwd()) {
  let d = resolve(dir);
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(d, ".git")) || existsSync(join(d, "package.json"))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return resolve(dir);
}

/** @typedef {{ name?: string, scripts?: Record<string,string>, dependencies?: Record<string,string>, devDependencies?: Record<string,string>, peerDependencies?: Record<string,string>, workspaces?: unknown }} PackageJson */

/** @param {string} dir @returns {PackageJson} */
export function readPackage(dir) {
  return readJsonFile(dir, "package.json") || {};
}

/** @param {string} dir */
function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Every dependency name of the root package (and workspace packages one level down). @param {string} dir */
export function dependencyNames(dir) {
  const names = new Set();
  const collect = (/** @type {PackageJson | null} */ pkg) => {
    for (const k of /** @type {const} */ (["dependencies", "devDependencies", "peerDependencies"]))
      for (const d of Object.keys(pkg?.[k] || {})) names.add(d);
  };
  collect(readPackage(dir));
  for (const ws of ["apps", "packages", "services"]) {
    const base = join(dir, ws);
    if (!existsSync(base)) continue;
    for (const p of safeReaddir(base)) collect(readJsonFile(base, join(p, "package.json")));
  }
  return names;
}

export const CONFIG_FILE = "abatty.config.json";
export const LEGACY_CONFIG = ".claude/adoption.json";

/** @param {unknown} v */
const isPlain = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Deep merge for plain objects: `over` wins; arrays and scalars are replaced, not merged. @param {Record<string, any>} base @param {Record<string, any>} over */
export function deepMerge(base, over) {
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [k, v] of Object.entries(over))
    out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k], v) : v;
  return out;
}

/**
 * The one configuration of the repository, or null when it has none: `abatty.config.json` at
 * the root over `.claude/adoption.json` (the older place), key by key. A file that does not
 * parse is skipped, never a crash; `abatty config` names it.
 * @param {string} dir @returns {Record<string, any> | null}
 */
export function readConfig(dir) {
  /** @param {string} rel @returns {Record<string, any> | null} */
  const read = (rel) => {
    try {
      const v = readJsonFile(dir, rel);
      return isPlain(v) ? v : null;
    } catch {
      return null;
    }
  };
  const legacy = read(LEGACY_CONFIG);
  const root = read(CONFIG_FILE);
  if (!legacy && !root) return null;
  return deepMerge(legacy || {}, root || {});
}

/** The merged configuration (see readConfig); the name the first days used. @param {string} dir */
export function readAdoption(dir) {
  return readConfig(dir);
}

/** True when a package.json script of that name exists. @param {string} dir @param {string} name */
export function hasScript(dir, name) {
  return typeof readPackage(dir).scripts?.[name] === "string";
}
