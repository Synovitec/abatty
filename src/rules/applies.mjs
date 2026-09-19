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

/** Sources of any language pack: the rules about the tools (the linter, the formatter, the typecheck, the dead-code tool, the test runner). @type {Applies} */
export const SOURCES = {
  when: "a repository with sources (any language pack)",
  stages: BUILT,
  applies: (c) => c.sourceFiles.length > 0 || "no sources",
};
/** JavaScript or TypeScript sources: the rules whose check reads that language. @type {Applies} */
export const JS_SOURCES = {
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
/**
 * A service: something with a process that runs, receives traffic and can be sent a signal.
 * The observability rules are its alone - a library has no health endpoint and a browser
 * application has no SIGTERM, so on those the finding is n/a with the reason.
 * @type {Applies}
 */
export const SERVICE = {
  when: "a repository with a server",
  stages: BUILT,
  applies: (c) => c.stack.server || "no server: nothing here receives traffic or a signal",
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

/**
 * A repository an agent works in unattended: the harness is installed, so the rules about the
 * sandbox, the permission surface and the trust boundary have a subject. A repository nobody
 * points a model at overnight is not failing them; it is not running them.
 * @type {Applies}
 */
export const HARNESSED = {
  when: "a repository with the agent harness installed",
  applies: (c) =>
    c.exists(".claude/settings.json") ||
    c.exists(".claude/hooks") ||
    Boolean(c.adoption) ||
    "no agent harness: nothing here runs unattended",
};
