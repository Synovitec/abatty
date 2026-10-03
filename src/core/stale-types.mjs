/**
 * A typecheck red on types a framework generated rather than on the code: Next writes route
 * types under `.next/types` (and `.next/dev/types`), and after a switch to a branch without a
 * route they still name it. An adopter lost a gate run of nearly four minutes to TS2307 errors
 * there, read as their own. The step stays red; the line says where the errors are and how the
 * generated files are rebuilt.
 */

/** A compiler error reported in a file Next generated. */
const GENERATED =
  /(?:^|[\s/\\])\.next[/\\](?:dev[/\\])?types[/\\][^\s(:]+\(\d+,\d+\): error TS\d+/m;

/**
 * The lines to add under a failed step whose output names errors in Next's generated types, or
 * none.
 * @param {string} output what the step printed @returns {string[]}
 */
export function staleTypesHint(output) {
  if (!GENERATED.test(output)) return [];
  return [
    "  errors in Next's generated types (.next/types): they go stale when a branch switch removes a route. Remove .next/types and .next/dev/types, run next typegen (or a dev or build run), and run the gate again",
  ];
}
