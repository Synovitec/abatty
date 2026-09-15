/** @param {string} line */
export function onlyRequiredPaths(line: string): boolean;
/** A sample of the trailer, built at runtime, for the guard's self-test. */
export function sampleTrailer(): string;
/** The decoded regex sources, in the list's order. */
export const TERMS: string[];
/** One case-insensitive expression for every term. */
export const FORBIDDEN: RegExp;
/** The same, global, for counting and locating matches in a text. */
export const FORBIDDEN_ALL: RegExp;
/**
 * The paths a repository can never scrub because the agent itself requires those names: its
 * settings folder (with or without a trailing slash) and its context file. A line that mentions
 * only those is not a finding. Order matters: the slashed form is replaced before the bare one.
 */
export const REQUIRED_PATHS: string[];
