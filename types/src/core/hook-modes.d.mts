/**
 * Where each hook script is wired: `Event` or `Event(matcher)`, per settings file, and whether any
 * of them (or the user's own settings) switches every hook off.
 * @param {string} repoDir @param {string} [home]
 * @returns {{ wiring: Map<string, string[]>, disabledBy: string | null }}
 */
export function hookWiring(repoDir: string, home?: string): {
    wiring: Map<string, string[]>;
    disabledBy: string | null;
};
/**
 * Each shipped hook's effective mode here. The day and night lines are the hook's documented
 * behaviour narrowed by this repository's config; `warn` is set where the narrowing leaves the
 * hook doing nothing, or doing something the reader would not expect.
 * @param {string} repoDir @param {{ home?: string }} [o] @returns {HookMode[]}
 */
export function hookModes(repoDir: string, o?: {
    home?: string;
}): HookMode[];
/**
 * `wired`: the events (and matchers) that run it; empty when no settings file does.
 * `warn`: the reason the effective mode is not the one the reader would assume.
 */
export type HookMode = {
    hook: string;
    wired: string[];
    day: string;
    night: string;
    warn?: string;
};
