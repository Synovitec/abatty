/**
 * Where a rule applies, as reusable pairs of `when` (the sentence the catalog prints) and
 * `applies` (the predicate over the repository's facts). A family spreads one into a rule:
 * `...SOURCES`. Where the predicate says no, the finding is n/a with the reason, never missing.
 */
/** @typedef {import("./context.mjs").RepoContext} RepoContext */
/** @typedef {{ when: string, applies: (c: RepoContext) => boolean | string }} Applies */
/** @type {Applies} */
export const SOURCES: Applies;
/** @type {Applies} */
export const PACKAGE: Applies;
/** @type {Applies} */
export const DATABASE: Applies;
/** @type {Applies} */
export const BROWSER: Applies;
/** @type {Applies} */
export const BOUNDARY: Applies;
/** @type {Applies} */
export const TEXT: Applies;
/** @type {Applies} */
export const PWA: Applies;
export type RepoContext = import("./context.mjs").RepoContext;
export type Applies = {
    when: string;
    applies: (c: RepoContext) => boolean | string;
};
