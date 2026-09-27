/**
 * What a passing coverage step's output says it measured, when that was nothing: the tool and
 * its line, or null when the output shows a measurement (or no tool the list knows).
 * @param {string} output
 * @returns {{ tool: string, line: string } | null}
 */
export function measuredNothing(output: string): {
    tool: string;
    line: string;
} | null;
/**
 * A coverage step that measured nothing. The step exits 0 whether it judged a thousand lines or
 * none, and a product's `vitest --coverage` over a push that touched nothing under
 * `coverage.include` printed "Unknown% ( 0/0 )" and read green, which is the same colour as a
 * push whose every changed line was covered. The gate cannot know what the step should have
 * measured; it can read what the tool says it measured, and say so when that was nothing.
 *
 * Only a tool's own words for "no data" count. A table row of zeros is not one: a file that
 * exists and is wholly untested reads 0% too, and that is a measurement.
 */
/**
 * How the coverage tools a profile may name say they measured nothing, each by the tool that
 * prints it. A tool missing here reads as a step that measured something, which is today's
 * behaviour, never a new red.
 * @type {[tool: string, re: RegExp][]}
 */
export const EMPTY_COVERAGE: [tool: string, re: RegExp][];
