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
