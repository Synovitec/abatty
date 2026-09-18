/**
 * @typedef {{ abatty: string, installedAt: string, files: Record<string, string> }} Lock
 * @typedef {"in step" | "updated" | "added" | "kept" | "merged" | "conflict" | "overwritten"} UpdateAction
 * @typedef {{ file: string, action: UpdateAction, detail?: string }} UpdateEvent
 */
/** The package's own version. */
export function packageVersion(): string;
/** Formatting-blind hash of a text. @param {string} text */
export function hashOf(text: string): string;
/** The files the package installs and keeps in step: the shipped pairs plus the preset's rules. @param {import("../presets/index.mjs").Preset | null} preset @returns {[string, string][]} */
export function managedFiles(preset: import("../presets/index.mjs").Preset | null): [string, string][];
/** The lock as the repository has it, or null. @param {string} repoDir @returns {Lock | null} */
export function readLock(repoDir: string): Lock | null;
/**
 * Record the package's version and, per managed file, the copy that is actually installed here -
 * the base of the next three-way merge. A file whose copy in the repository is the package's is
 * recorded at that hash, with the shipped text kept beside it as the base. A file that differs
 * (init keeps an existing file, and a repository edits its hooks) was NOT installed at this
 * version, so its earlier entry and its earlier base are carried over untouched; a file with no
 * earlier entry is left out, and `update` then has no ancestor to merge from and writes the
 * package's version beside it rather than over it. Recording the package's hash for every file
 * was the bug: a file the repository kept read as its own edit that the package never changed,
 * and `update` refused to deliver a real change to it for as long as the repository lived.
 * @param {string} repoDir @param {import("../presets/index.mjs").Preset | null} preset @param {string} [version]
 */
export function writeLock(repoDir: string, preset: import("../presets/index.mjs").Preset | null, version?: string): Lock;
/**
 * Three-way merge with git: yours, the base, theirs. Returns the merged text and the number of
 * conflicts (0 is clean), or null when git could not merge at all.
 * @param {string} ours @param {string} base @param {string} theirs
 */
export function mergeFile(ours: string, base: string, theirs: string): {
    text: string;
    conflicts: number;
} | null;
/**
 * Add to `target` every key `source` has and it lacks, recursively for plain objects; a value
 * the target has is never replaced. Returns the keys added, dotted.
 * @param {Record<string, any>} target @param {Record<string, any>} source @param {string} [prefix]
 */
export function addMissingKeys(target: Record<string, any>, source: Record<string, any>, prefix?: string): string[];
/**
 * Update the harness. Returns the events, the version the repository had and the one it has now.
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset | null, force?: boolean, dryRun?: boolean, version?: string }} o
 */
export function updateRepo(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset | null;
    force?: boolean;
    dryRun?: boolean;
    version?: string;
}): {
    events: UpdateEvent[];
    from: string | null;
    to: string;
    conflicts: number;
};
export const LOCK: ".claude/harness.lock.json";
export const BASE_DIR: ".abatty/harness";
export type Lock = {
    abatty: string;
    installedAt: string;
    files: Record<string, string>;
};
export type UpdateAction = "in step" | "updated" | "added" | "kept" | "merged" | "conflict" | "overwritten";
export type UpdateEvent = {
    file: string;
    action: UpdateAction;
    detail?: string;
};
