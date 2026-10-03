/**
 * Prove a repository's checks on a copy of it: each always-on gate step of the preset planted
 * with a violation and judged; `suites` adds the build, browser and database suites. What the
 * steps printed is kept outside the repository (`logs`).
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset, suites?: boolean, log?: (line: string) => void }} o
 * @returns {ReturnType<typeof runStepControls> & { logs?: string }}
 */
export function prove(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset;
    suites?: boolean;
    log?: (line: string) => void;
}): ReturnType<typeof runStepControls> & {
    logs?: string;
};
import { runStepControls } from "./step-controls.mjs";
