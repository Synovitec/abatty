/**
 * The folder a planted source file goes in: `src` where the repository has one; in a monorepo
 * without it, the source folder of the first workspace that has one; else the framework's own.
 * A monorepo whose steps scan `apps/web/lib` read every control planted in a root `src/` as a
 * step that stayed green, and three steps that had been watched failing by hand read as absent.
 * @param {string} dir
 */
export function plantRoot(dir: string): string;
/** The prefix of every file a control plants, so a planted file is never mistaken for the repository's own and is always removed. */
export const MARK: "abatty-control.__";
/** The planted violation per step, by the script it runs or the built-in it is. @type {Record<string, StepControl>} */
export const STEP_CONTROLS: Record<string, StepControl>;
/** What no planted file proves, said rather than left out: a step in this list is reported as `none` with the reason. @type {Record<string, string>} */
export const NO_CONTROL: Record<string, string>;
export type PlantContext = {
    deps: Set<string>;
    pack: string;
    dir: string;
    scripts: Record<string, string>;
};
export type StepControl = {
    files: (c: PlantContext) => Record<string, string>;
    means: string;
};
