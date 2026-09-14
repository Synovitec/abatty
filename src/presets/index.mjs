/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 *
 * @typedef {{ label: string, script?: string, command?: string[], requires?: string[], alternatives?: string[], rangeArg?: boolean }} GateStep
 * @typedef {{ name: string, paths: RegExp, docker?: boolean, steps: GateStep[] }} GateSuite
 * @typedef {{
 *   id: string,
 *   name: string,
 *   proven?: string,
 *   detect: (deps: Set<string>) => boolean,
 *   adoption: Record<string, unknown>,
 *   scripts: Record<string, string>,
 *   devDependencies: string[],
 *   gate: { always: GateStep[], suites: GateSuite[] },
 *   rules: string[],
 *   tooling: { dependencyCruiser: boolean, knip: boolean },
 * }} Preset
 */
import { next } from "./next.mjs";
import { viteReact } from "./vite-react.mjs";
import { node } from "./node.mjs";

/** @type {Preset[]} */
export const presets = [next, viteReact, node];

/** @param {string} id */
export function presetById(id) {
  return presets.find((p) => p.id === id) || null;
}

/**
 * The preset a repository's dependencies point at, or null. Order matters: the more specific
 * stack first (a Vite React app also depends on react; a Next app also depends on react).
 * @param {Set<string>} deps
 */
export function detectPreset(deps) {
  return presets.find((p) => p.detect(deps)) || null;
}
