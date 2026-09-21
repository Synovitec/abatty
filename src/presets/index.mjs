/**
 * The stack presets. A preset is proven by a repository (the standard's rule for a reference
 * implementation); one that no repository has run is marked `proven: false` and `init` says so.
 * A monorepo composes them: workspaces.mjs detects one preset per workspace folder, gated in
 * its own folder, the repository-level steps once.
 *
 * @typedef {{ label: string, script?: string, command?: string[], builtin?: "secrets" | "audit" | "scrub", requires?: string[], alternatives?: string[], rangeArg?: boolean, required?: boolean }} GateStep
 *   `required`: the step is the instrument, not an option. Without its script the gate cannot
 *   run rather than passing with the step skipped: a repository whose every step is skipped for
 *   want of a script read "gate green" and exit 0 (an outside trial's finding). What is required
 *   is the preset's word: the tests and the ratchet everywhere code is, the typecheck where the
 *   preset is TypeScript-native; a linter or a graph is a dependency decision the repository makes.
 * @typedef {{ name: string, paths: RegExp, docker?: boolean, steps: GateStep[] }} GateSuite
 * @typedef {{ file: string, needs: string[] }} PresetRule a rule file that applies only where the
 *   repository depends on one of `needs`. A bare string always applies.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   proven?: string,
 *   detect: (deps: Set<string>) => boolean,
 *   detectFiles?: (files: (re: RegExp) => string[]) => boolean,
 *   pack?: string,
 *   adoption: Record<string, unknown>,
 *   scripts: Record<string, string>,
 *   devDependencies: string[],
 *   gate: { always: GateStep[], suites: GateSuite[] },
 *   rules: (string | PresetRule)[],
 *   tooling: { dependencyCruiser: boolean, knip: boolean },
 * }} Preset
 */
import { next } from "./next.mjs";
import { viteReact } from "./vite-react.mjs";
import { node } from "./node.mjs";
import { astro } from "./astro.mjs";
import { docs } from "./docs.mjs";
import { python } from "./python.mjs";

/** @type {Preset[]} */
export const presets = [next, astro, viteReact, node, python, docs];

/** @param {string} id */
export function presetById(id) {
  return presets.find((p) => p.id === id) || null;
}

/**
 * The preset a repository's dependencies point at, or null. Order matters: the more specific
 * stack first (a Vite React app also depends on react; a Next app also depends on react).
 * A preset without npm dependencies (Python) is detected from the tree when `files` is given.
 * @param {Set<string>} deps @param {(re: RegExp) => string[]} [files]
 */
export function detectPreset(deps, files) {
  return (
    presets.find((p) => p.detect(deps)) ||
    (files ? presets.find((p) => p.detectFiles && p.detectFiles(files)) : null) ||
    null
  );
}

/**
 * The preset's rule files judged against the repository, the way the catalog's rules are judged
 * by their `applies` predicate. A rule file about one library is guidance nobody can act on
 * without that library, and writing it anyway teaches a reader that the harness does not know
 * this repository: a project with no ORM was receiving the ORM rules. A bare string is a
 * practice every repository of this stack owes (testing, size limits, accessibility) and always
 * applies; a `{ file, needs }` entry applies only where one of `needs` is a dependency.
 *
 * Returns every entry with its verdict, so `init` can say what it skipped and why rather than
 * silently writing fewer files.
 * @param {Preset | null} preset @param {Set<string>} deps
 * @returns {{ file: string, applies: boolean, needs: string[] }[]}
 */
export function presetRules(preset, deps) {
  return (preset?.rules || []).map((r) => {
    if (typeof r === "string") return { file: r, applies: true, needs: [] };
    return { file: r.file, applies: r.needs.some((d) => deps.has(d)), needs: r.needs };
  });
}
