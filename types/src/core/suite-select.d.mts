/**
 * A dev server holding this folder, read from the lock files a preset names for its framework
 * (`.next/dev/lock` for Next.js, which writes its pid there). The pid is asked whether it is alive,
 * so a lock left behind by a crash does not defer the suite forever. Null when none is live.
 * @param {string} dir the folder the suite runs in
 * @param {string[]} [locks] the lock files, relative to `dir`
 * @returns {{ lock: string, pid: number, port?: number } | null}
 */
export function liveDevServer(dir: string, locks?: string[]): {
    lock: string;
    pid: number;
    port?: number;
} | null;
/**
 * The files of a range whose two versions differ only in whole-line comments: they change
 * no behaviour, so they select no suite. Both versions are read whole and compared with their
 * comments blanked by the probes' lexer, rather than judged line by line from a diff, where a
 * CSS `#id` selector or a `* 2` continuation reads as a comment. Only the languages the lexer
 * knows are judged, and a file missing at either end is never counted: a guess that skips a
 * suite is the expensive direction to be wrong in.
 * @param {string} repoDir @param {string} range `from..to`; a three-dot range judges nothing
 * @param {string[]} files
 * @returns {Set<string>}
 */
export function commentOnly(repoDir: string, range: string, files: string[]): Set<string>;
/**
 * Whether a suite's paths match a file the push or the tree touches: under a workspace's folder
 * for a workspace's preset, and from the root or the app's homes for the root's
 * (src/presets/app-homes.mjs).
 * @param {RegExp} paths @param {string[]} files @param {string} under "" for the root
 * @param {string[]} homes the root app's homes
 */
export function selectedByPath(paths: RegExp, files: string[], under: string, homes: string[]): boolean;
/**
 * A selected suite whose testing steps have no script: no step but `build` has one, so nothing
 * would be judged and nothing runs. It built the app on every push, only to skip the tests after
 * it. Returned with what the gate records and says; null when a testing step has its script
 * (integration without coverage runs).
 * @param {import("../presets/index.mjs").GateSuite} suite @param {string} name as the gate labels it
 * @param {(s: import("../presets/index.mjs").GateStep) => boolean} has
 * @returns {{ event: import("./gate.mjs").GateEvent, says: string } | null}
 */
export function untestedSuite(suite: import("../presets/index.mjs").GateSuite, name: string, has: (s: import("../presets/index.mjs").GateStep) => boolean): {
    event: import("./gate.mjs").GateEvent;
    says: string;
} | null;
/**
 * The root app's homes in this repository: the folders holding its marker that no workspace with
 * a preset of its own covers (src/presets/app-homes.mjs).
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset} preset
 * @param {{ path: string }[]} gated the workspaces with a preset
 */
export function suiteHomes(repoDir: string, preset: import("../presets/index.mjs").Preset, gated: {
    path: string;
}[]): string[];
