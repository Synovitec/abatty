/**
 * The dated readings of a list of paths, by series (folder and stem), each series oldest first.
 * @param {string[]} paths
 * @returns {string[][]}
 */
export function readingSeries(paths: string[]): string[][];
/** A dated reading: `<stem>_<YYYY-MM-DD>.md` (or `-<date>`), one of a series sharing its stem. */
export const DATED_READING: RegExp;
/** @type {import("../index.mjs").Probe[]} */
export const probes: import("../index.mjs").Probe[];
