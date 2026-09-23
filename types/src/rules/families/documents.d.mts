/**
 * Documents: the agent's context file, the path-scoped rules, the conventions, the progress
 * scoreboard, the changelog, the docs index, the decisions, front matter and freshness.
 * Standard §2.1, DOC.1..5, AIR.1, CHANGE.1, FLOW.4.
 */
/**
 * The template's placeholders a context file still carries: angle-bracketed text with a space
 * in it (`<project name>`, `<e.g. ...>`, `<takes direct pushes | is PR-only>`). A convention
 * written the same way has none (`<topic>`, `<type>/<short-description>`, `<agent>`), and an
 * HTML comment or tag is not one. A context file that is the unfilled template passed every
 * check for two days on a trial repository, because the sections were all there. Code is not a
 * question: angle brackets inside an inline code span or a fenced block are an example written
 * down (`-- <which case>` in a comment an adopter's context quoted), never a blank to fill.
 * @param {string} text
 */
export function templatePlaceholders(text: string): string[];
/** @type {import("../index.mjs").Rule[]} */
export const rules: import("../index.mjs").Rule[];
