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
