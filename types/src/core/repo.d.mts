/** JSON.parse that tolerates a UTF-8 BOM (Windows PowerShell 5.1 writes one). @param {string} text */
export function parseJson(text: string): any;
/** @param {string} dir @param {string} rel */
export function readJsonFile(dir: string, rel: string): any;
/** Writes JSON without a BOM, LF, trailing newline - the way the hooks read it back. @param {string} dir @param {string} rel @param {unknown} value */
export function writeJsonFile(dir: string, rel: string, value: unknown): void;
/**
 * The print width the formatter uses for a file under `dir`: `printWidth` in the nearest
 * .prettierrc or package.json up the tree, as the formatter looks it up; 80, its own default,
 * otherwise. A config written as code is not read, and 80 holds for it.
 * @param {string} dir
 */
export function printWidth(dir: string): any;
/**
 * JSON as the formatter a repository runs would write it, so a file this package writes does not
 * fail that repository's format check the next time it is written: an adopter had to put the
 * baseline in .prettierignore. Objects are expanded (the formatter keeps an expanded object as
 * it is); an array of plain values goes on one line when the line fits the width, one value per
 * line otherwise, which is what the formatter does and what JSON.stringify never does.
 * @param {unknown} value @param {number} [width]
 */
export function formatJson(value: unknown, width?: number): string;
/** Run git in a directory; "" when it fails - a command must never crash on git. @param {string} dir @param {string[]} args */
export function git(dir: string, ...args: string[]): string;
/**
 * The repository root: the nearest ancestor with a .git or a package.json, or the directory
 * itself. A command run from a subfolder still works on the whole repository.
 * @param {string} [dir]
 */
export function repoRoot(dir?: string): string;
/** @typedef {{ name?: string, scripts?: Record<string,string>, dependencies?: Record<string,string>, devDependencies?: Record<string,string>, peerDependencies?: Record<string,string>, workspaces?: unknown, packageManager?: string }} PackageJson */
/** @param {string} dir @returns {PackageJson} */
export function readPackage(dir: string): PackageJson;
/** Every dependency name of the root package (and workspace packages one level down). @param {string} dir */
export function dependencyNames(dir: string): Set<any>;
/** Deep merge for plain objects: `over` wins; arrays and scalars are replaced, not merged. @param {Record<string, any>} base @param {Record<string, any>} over */
export function deepMerge(base: Record<string, any>, over: Record<string, any>): Record<string, any>;
/**
 * The one configuration of the repository, or null when it has none: `abatty.config.json` at
 * the root over `.claude/adoption.json` (the older place), key by key. A file that does not
 * parse is skipped, never a crash; `abatty config` names it.
 * @param {string} dir @returns {Record<string, any> | null}
 */
export function readConfig(dir: string): Record<string, any> | null;
/** The merged configuration (see readConfig); the name the first days used. @param {string} dir */
export function readAdoption(dir: string): Record<string, any> | null;
/** True when a package.json script of that name exists. @param {string} dir @param {string} name */
export function hasScript(dir: string, name: string): boolean;
/** The one configuration of a repository, at its root, where the hooks and the gate both read it. */
export const CONFIG_FILE: "abatty.config.json";
/** Where the configuration lived before it moved to the root; still read, key by key under the root one, so an older repository keeps working. */
export const LEGACY_CONFIG: ".claude/adoption.json";
export type PackageJson = {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    workspaces?: unknown;
    packageManager?: string;
};
