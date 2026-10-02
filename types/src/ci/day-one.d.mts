/** The pipelines a repository keeps, by the forges' own conventions. @param {string} repoDir */
export function pipelinesOf(repoDir: string): string[];
/**
 * Whether CI runs the gate here: `gate` when a pipeline runs the whole gate, `fast` when the
 * best one runs it without its suites, `no-gate` when pipelines exist and none runs it, `none`
 * when there is no pipeline at all.
 * @param {string} repoDir
 * @returns {{ state: "gate" | "fast" | "no-gate" | "none", pipelines: string[] }}
 */
export function ciGate(repoDir: string): {
    state: "gate" | "fast" | "no-gate" | "none";
    pipelines: string[];
};
/** Whether the repository's forge is GitHub: a GitHub remote, or a .github folder. @param {string} repoDir */
export function onGithub(repoDir: string): boolean;
/**
 * The day-one workflow: the repository's own install, then the fast gate, on every push and pull
 * request, with read-only permissions and the actions pinned as the full pipeline pins them.
 * @param {string} repoDir @returns {string}
 */
export function dayOneWorkflow(repoDir: string): string;
/**
 * What doctor and init say about CI and the gate, when it is not the whole gate on every push.
 * @param {ReturnType<typeof ciGate>} ci @returns {string}
 */
export function ciSays(ci: ReturnType<typeof ciGate>): string;
/** Where the day-one workflow goes. */
export const DAY_ONE: ".github/workflows/abatty-gate.yml";
