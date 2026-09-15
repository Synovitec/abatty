/**
 * Where a rule applies, as reusable pairs of `when` (the sentence the catalog prints) and
 * `applies` (the predicate over the repository's facts). A family spreads one into a rule:
 * `...SOURCES`. Where the predicate says no, the finding is n/a with the reason, never missing.
 */

/** @typedef {import("./context.mjs").RepoContext} RepoContext */
/** @typedef {{ when: string, applies: (c: RepoContext) => boolean | string }} Applies */

/** @type {Applies} */
export const SOURCES = {
  when: "a repository with JavaScript or TypeScript sources",
  applies: (c) => c.stack.js || "no JavaScript or TypeScript sources",
};
/** @type {Applies} */
export const PACKAGE = {
  when: "a repository with a package manifest",
  applies: (c) => c.stack.package || "no package.json",
};
/** @type {Applies} */
export const DATABASE = {
  when: "a repository with a database",
  applies: (c) => c.stack.database || "no database dependency",
};
/** @type {Applies} */
export const BROWSER = {
  when: "a browser application",
  applies: (c) => c.stack.ui || "no browser application",
};
/** @type {Applies} */
export const BOUNDARY = {
  when: "a repository with a server, an API or a browser application",
  applies: (c) =>
    c.stack.server || c.stack.ui || "no boundary: neither a server nor a browser application",
};
/** @type {Applies} */
export const TEXT = {
  when: "a browser application, or a repository with translation catalogues",
  applies: (c) => c.stack.ui || c.stack.i18n || "no user-facing text",
};
/** @type {Applies} */
export const PWA = {
  when: "a repository with a service worker or a web manifest",
  applies: (c) => c.stack.pwa || "no service worker and no web manifest",
};
