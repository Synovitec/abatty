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
/**
 * The internal dependency graph: per workspace, the workspaces it names in its own manifest.
 * A name that is not another workspace's name is a registry dependency and is not an edge.
 * The name is read from each workspace's own manifest rather than taken from the caller, so the
 * graph is correct for any caller that knows only the folders.
 * @param {string} repoDir @param {{ path: string }[]} workspaces
 * @returns {{ edges: Map<string, Set<string>>, read: number }} edges: dependent → dependencies
 */
export function workspaceGraph(repoDir: string, workspaces: {
    path: string;
}[]): {
    edges: Map<string, Set<string>>;
    read: number;
};
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
export function affectedWorkspaces(repoDir: string, workspaces: {
    path: string;
}[], changed: string[]): {
    selected: Set<string>;
    viaGraph: Map<string, string>;
    everything: string | null;
};
export type Workspace = {
    path: string;
    name: string;
    presetId: string;
    preset: import("./index.mjs").Preset | null;
    from: "config" | "deps" | "none";
};
