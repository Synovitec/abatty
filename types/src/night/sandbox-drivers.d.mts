/**
 * @typedef {{
 *   repoDir: string,
 *   logDir: string,
 *   readOnly: string[],
 *   writable: string[],
 *   env: string[],
 *   command: string,
 *   image: string,
 *   profile: string,
 *   home: string,
 * }} Plan absolute, existing paths; `logDir` the hooks' log folder under the harness; `env` the variable names a container passes through;
 * `profile` where the Seatbelt profile is written; `home` the container's HOME.
 * @typedef {{
 *   driver: string,
 *   node: string,
 *   describe: string,
 *   wrap: (cmd: string, args: string[], env?: string[]) => { cmd: string, args: string[] },
 * }} Sandbox `node` is how the probe reaches a Node inside the boundary.
 */
/** @param {Plan} plan @returns {Sandbox} */
export function bwrapSandbox(plan: Plan): Sandbox;
/** The Seatbelt profile: the last matching rule wins, so the order below is the boundary. @param {Plan} plan */
export function seatbeltProfile(plan: Plan): string;
/** @param {Plan} plan @returns {Sandbox} */
export function seatbeltSandbox(plan: Plan): Sandbox;
/**
 * A container: the tree and the agent's state mounted, the harness mounted read-only over it,
 * the night's variables passed by name. The image carries the agent and a Node; `sandbox.image`
 * names it, `sandbox.command` the engine (docker by default, podman works the same).
 * @param {Plan} plan @returns {Sandbox}
 */
export function containerSandbox(plan: Plan): Sandbox;
/** @param {string} driver @param {Plan} plan @returns {Sandbox} */
export function buildSandbox(driver: string, plan: Plan): Sandbox;
/**
 * absolute, existing paths; `logDir` the hooks' log folder under the harness; `env` the variable names a container passes through;
 * `profile` where the Seatbelt profile is written; `home` the container's HOME.
 */
export type Plan = {
    repoDir: string;
    logDir: string;
    readOnly: string[];
    writable: string[];
    env: string[];
    command: string;
    image: string;
    profile: string;
    home: string;
};
/**
 * `node` is how the probe reaches a Node inside the boundary.
 */
export type Sandbox = {
    driver: string;
    node: string;
    describe: string;
    wrap: (cmd: string, args: string[], env?: string[]) => {
        cmd: string;
        args: string[];
    };
};
