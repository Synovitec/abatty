/**
 * The profiles `init` sets up and what they bring.
 * @param {string} repoDir @param {{ profile?: string, agents?: string[] }} o
 * @returns {{ profiles: string[], full: boolean, harness: boolean, name: boolean }} `full` is the
 * synovitec setup, `harness` the agent's files, `name` whether the config is told the profiles
 */
export function initScope(repoDir: string, o: {
    profile?: string;
    agents?: string[];
}): {
    profiles: string[];
    full: boolean;
    harness: boolean;
    name: boolean;
};
/**
 * The preset's scripts and dev dependencies as the scope takes them. Under a profile without the
 * standard, no dead-code step: it is none of minimal's rules, and its zero-issue default turned an
 * existing codebase's first gate red, where the ratchet promises old debt never blocks a push.
 * TypeScript is installed only where the repository has a tsconfig: a plain JavaScript package
 * was given a compiler it never runs.
 * @param {{ full: boolean }} scope @param {string} repoDir
 * @param {{ scripts: Record<string, string>, devDependencies: string[], tooling: { knip: boolean } }} preset
 */
export function scopedTools(scope: {
    full: boolean;
}, repoDir: string, preset: {
    scripts: Record<string, string>;
    devDependencies: string[];
    tooling: {
        knip: boolean;
    };
}): {
    knip: boolean;
    scripts: {
        [k: string]: string;
    };
    devDependencies: string[];
};
