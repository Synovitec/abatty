/** @param {string} id */
export function presetById(id: string): Preset | null;
/**
 * The preset a repository's dependencies point at, or null. Order matters: the more specific
 * stack first (a Vite React app also depends on react; a Next app also depends on react).
 * @param {Set<string>} deps
 */
export function detectPreset(deps: Set<string>): Preset | null;
/** @type {Preset[]} */
export const presets: Preset[];
/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 */
export type GateStep = {
    label: string;
    script?: string;
    command?: string[];
    requires?: string[];
    alternatives?: string[];
    rangeArg?: boolean;
};
/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
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
 */
export type Preset = {
    id: string;
    name: string;
    proven?: string;
    detect: (deps: Set<string>) => boolean;
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
