/** Sources of any language pack: the rules about the tools (the linter, the formatter, the typecheck, the dead-code tool, the test runner). @type {Applies} */
export const SOURCES: Applies;
/** JavaScript or TypeScript sources: the rules whose check reads that language. @type {Applies} */
export const JS_SOURCES: Applies;
/** @type {Applies} */
export const PACKAGE: Applies;
/** @type {Applies} */
export const DATABASE: Applies;
/** @type {Applies} */
export const BROWSER: Applies;
/** @type {Applies} */
export const BOUNDARY: Applies;
/**
 * A service: something with a process that runs, receives traffic and can be sent a signal.
 * The observability rules are its alone - a library has no health endpoint and a browser
 * application has no SIGTERM, so on those the finding is n/a with the reason.
 * @type {Applies}
 */
export const SERVICE: Applies;
/** @type {Applies} */
export const TEXT: Applies;
/** @type {Applies} */
export const PWA: Applies;
/**
 * A repository an agent works in unattended: the harness is installed, so the rules about the
 * sandbox, the permission surface and the trust boundary have a subject. A repository nobody
 * points a model at overnight is not failing them; it is not running them.
 * @type {Applies}
 */
export const HARNESSED: Applies;
export type RepoContext = import("./context.mjs").RepoContext;
export type Applies = {
    when: string;
    applies: (c: RepoContext) => boolean | string;
    stages?: import("./stage.mjs").Stage[];
};
