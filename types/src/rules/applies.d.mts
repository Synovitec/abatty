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
    stages?: import("./stage.mjs").Stage[];
};
