/**
 * The path a failing test has to take for the repository's own test script to run it: the first
 * test glob the script reaches decides the folder and the name; a task runner defers to the
 * workspace that runs the task; a folder handed to a runner decides the folder. With none of
 * these (`vitest run`), the convention-based path, because the runner's own default finds it.
 * @param {string} dir the repository @param {string} script @param {PlantHow} how
 * @returns {string}
 */
export function testPlantPath(dir: string, script: string, how: PlantHow): string;
export type PlantHow = {
    extOf: (dir: string) => string;
    rootOf: (dir: string) => string;
    mark: string;
};
