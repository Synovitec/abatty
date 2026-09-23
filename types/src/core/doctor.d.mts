/** @typedef {{ file: string, state: "in step" | "differs" | "missing" }} DriftEvent */
/**
 * Formatting-blind comparison: whitespace, trailing commas (before `}`, `]` and `)`, since
 * Prettier's trailingComma "all" puts one after the last call argument too), quote style and
 * the escapes a quote swap changes ('a "b"' becomes "a \"b\"") and the parentheses Prettier
 * removes around a nested ternary do not count. A change to a quote or a parenthesis alone is
 * therefore invisible here; a change to any other character is not - drift means an edit to
 * the hook's logic, and an edit to logic changes identifiers, keywords or operators.
 * @param {string} text
 */
export function normalise(text: string): string;
/** The template → repository path map the package keeps in step. */
/** @returns {[string, string][]} */
export function shippedFiles(): [string, string][];
/**
 * @param {string} repoDir
 * @returns {DriftEvent[]}
 */
export function drift(repoDir: string): DriftEvent[];
/** Run the repository's own harness self-test; { code, output }. @param {string} repoDir */
export function selfTest(repoDir: string): {
    code: number;
    output: string;
};
/**
 * @param {{ repoDir: string, preset: import("../presets/index.mjs").Preset | null, strict?: boolean, skipSelfTest?: boolean, controls?: boolean, log?: (line: string) => void }} o
 */
export function doctor(o: {
    repoDir: string;
    preset: import("../presets/index.mjs").Preset | null;
    strict?: boolean;
    skipSelfTest?: boolean;
    controls?: boolean;
    log?: (line: string) => void;
}): {
    ok: boolean;
    selfTest: {
        code: number;
        output: string;
    };
    drift: DriftEvent[];
    missing: DriftEvent[];
    differs: DriftEvent[];
    missingScripts: (string | undefined)[];
    installed: string | null;
    pinned: string | null;
    packageVersion: string;
    config: {
        files: string[];
        problems: string[];
    };
    controls: {
        at: string;
        abatty: string;
        steps: StepOutcome[];
        absent: string[];
    } | null;
    hooks: import("./hook-modes.mjs").HookMode[];
};
export type DriftEvent = {
    file: string;
    state: "in step" | "differs" | "missing";
};
