/**
 * @typedef {{ path: string, name: string, presetId: string, preset: import("./index.mjs").Preset | null, from: "config" | "deps" | "none" }} Workspace
 */
/** The folder globs a repository names, or the conventional ones. @param {string} repoDir */
export function workspaceGlobs(repoDir: string): any;
/** The folders a glob list names that carry a package.json, repository-relative. @param {string} repoDir @param {string[]} globs */
export function workspaceFolders(repoDir: string, globs: string[]): string[];
/**
 * The workspaces of a repository with their presets: the config's naming wins, else the
 * detection from the workspace's own dependencies, else none (listed, not gated).
 * @param {string} repoDir @param {any} config
 * @returns {Workspace[]}
 */
export function detectWorkspaces(repoDir: string, config: any): Workspace[];
export type Workspace = {
    path: string;
    name: string;
    presetId: string;
    preset: import("./index.mjs").Preset | null;
    from: "config" | "deps" | "none";
};
