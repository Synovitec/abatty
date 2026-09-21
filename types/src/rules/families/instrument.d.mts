/**
 * The instrument: the ratchet and its baseline, the per-file floors, the control cases, the
 * gate, the pre-commit hook, CI and its steps. Standard §2.2-2.4, P.1, P.2, SEC.1.
 */
/**
 * The package scripts a pipeline's text invokes (`npm run x`, `pnpm run x`, `yarn x`, `bun run
 * x`, with or without `-s`/`--silent`), and which of them the package does not have. A pipeline
 * is credited for what it can run, not for what it names: the generated one on a trial repository
 * named five scripts the package lacked, was red from its first run, and still counted as
 * "present" for six points of score.
 * @param {string} ciText @param {Record<string, string>} scripts
 */
export function phantomScripts(ciText: string, scripts: Record<string, string>): any[];
/** @type {import("../index.mjs").Rule[]} */
export const rules: import("../index.mjs").Rule[];
