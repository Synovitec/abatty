/**
 * Where a rule applies, as reusable pairs of `when` (the sentence the catalog prints) and
 * `applies` (the predicate over the repository's facts). A family spreads one into a rule:
 * `...SOURCES`. Where the predicate says no, the finding is n/a with the reason, never missing.
 * Every pair here concerns an application's surface, so each belongs to the build and run
 * stages: at design the rule is n/a with the stage named.
 */

/** @typedef {import("./context.mjs").RepoContext} RepoContext */
/** @typedef {{ when: string, applies: (c: RepoContext) => boolean | string, stages?: import("./stage.mjs").Stage[] }} Applies */

/** The stages an application's surfaces exist at: not design. @type {import("./stage.mjs").Stage[]} */
const BUILT = ["build", "run"];

/** @type {Applies} */
export const SOURCES = {
  when: "a repository with JavaScript or TypeScript sources",
  stages: BUILT,
  applies: (c) => c.stack.js || "no JavaScript or TypeScript sources",
};
/** @type {Applies} */
export const PACKAGE = {
  when: "a repository with a package manifest",
  stages: BUILT,
  applies: (c) => c.stack.package || "no package.json",
};
/** @type {Applies} */
export const DATABASE = {
  when: "a repository with a database",
  stages: BUILT,
  applies: (c) => c.stack.database || "no database dependency",
};
/** @type {Applies} */
export const BROWSER = {
  when: "a browser application",
  stages: BUILT,
  applies: (c) => c.stack.ui || "no browser application",
};
/** @type {Applies} */
export const BOUNDARY = {
  when: "a repository with a server, an API or a browser application",
  stages: BUILT,
  applies: (c) =>
    c.stack.server || c.stack.ui || "no boundary: neither a server nor a browser application",
};
/** @type {Applies} */
export const TEXT = {
  when: "a browser application, or a repository with translation catalogues",
  stages: BUILT,
  applies: (c) => c.stack.ui || c.stack.i18n || "no user-facing text",
};
/** @type {Applies} */
export const PWA = {
  when: "a repository with a service worker or a web manifest",
  stages: BUILT,
  applies: (c) => c.stack.pwa || "no service worker and no web manifest",
};
