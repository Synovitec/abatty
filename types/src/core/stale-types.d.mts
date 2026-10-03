/**
 * The lines to add under a failed step whose output names errors in Next's generated types, or
 * none.
 * @param {string} output what the step printed @returns {string[]}
 */
export function staleTypesHint(output: string): string[];
