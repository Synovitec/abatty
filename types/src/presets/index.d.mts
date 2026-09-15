/** @param {string} id */
export function presetById(id: string): Preset | null;
/**
 * The preset a repository's dependencies point at, or null. Order matters: the more specific
 * stack first (a Vite React app also depends on react; a Next app also depends on react).
 * A preset without npm dependencies (Python) is detected from the tree when `files` is given.
 * @param {Set<string>} deps @param {(re: RegExp) => string[]} [files]
 */
export function detectPreset(deps: Set<string>, files?: (re: RegExp) => string[]): Preset | null;
/** @type {Preset[]} */
export const presets: Preset[];
/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 * A monorepo composes them: workspaces.mjs detects one preset per workspace folder, gated in
 * its own folder, the repository-level steps once.
 */
export type GateStep = {
    label: string;
    script?: string;
    command?: string[];
    builtin?: "secrets" | "audit";
    requires?: string[];
    alternatives?: string[];
    rangeArg?: boolean;
};
/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 * A monorepo composes them: workspaces.mjs detects one preset per workspace folder, gated in
 * its own folder, the repository-level steps once.
 */
export type GateSuite = {
    name: string;
    paths: RegExp;
    docker?: boolean;
    steps: GateStep[];
};
/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 * A monorepo composes them: workspaces.mjs detects one preset per workspace folder, gated in
 * its own folder, the repository-level steps once.
 */
export type Preset = {
    id: string;
    name: string;
    proven?: string;
    detect: (deps: Set<string>) => boolean;
    detectFiles?: (files: (re: RegExp) => string[]) => boolean;
    pack?: string;
    adoption: Record<string, unknown>;
    scripts: Record<string, string>;
    devDependencies: string[];
    gate: {
        always: GateStep[];
        suites: GateSuite[];
    };
    rules: string[];
    tooling: {
        dependencyCruiser: boolean;
        knip: boolean;
    };
};
