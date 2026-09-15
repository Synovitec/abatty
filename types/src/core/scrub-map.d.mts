/**
 * A Python callback for `git filter-repo --message-callback`: drops the trailer and URL lines
 * outright, then applies the map to what is left. Printed by `abatty scrub --history`, never run
 * by it: rewriting history is a deliberate step from a fresh clone, followed by a force-push and
 * the hosting provider's purge request.
 */
export function filterRepoCallback(): string;
/** @type {Record<string, string>} */
export const DEFAULT_MAP: Record<string, string>;
