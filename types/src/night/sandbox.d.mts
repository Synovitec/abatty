/**
 * The config's `sandbox` block, normalised; a mode given on the command line wins.
 * @param {any} config @param {string} [override]
 * @returns {SandboxConfig}
 */
export function sandboxConfig(config: any, override?: string): SandboxConfig;
/** @param {string} bin true when the executable runs at all (ENOENT is the one failure that counts). */
export function found(bin: string): boolean;
/**
 * The driver for this machine: the configured one, else the image's container engine, else
 * bubblewrap on Linux, else sandbox-exec on macOS, else none.
 * @param {SandboxConfig} cfg @param {(bin: string) => boolean} [has]
 */
export function detectDriver(cfg: SandboxConfig, has?: (bin: string) => boolean): string;
/**
 * The boundary as paths: what the harness needs read-only, what the hooks and the agent need
 * writable. Only paths that exist are bound; a protected prefix such as `.env.` is a rule for
 * the guard, not a mount.
 * @param {SandboxConfig} cfg
 * @param {{ repoDir: string, folder: string, protectedPaths: string[], nightDir: string }} c
 * @returns {Plan}
 */
export function sandboxPlan(cfg: SandboxConfig, c: {
    repoDir: string;
    folder: string;
    protectedPaths: string[];
    nightDir: string;
}): Plan;
/**
 * The verdict on a probe's line: what must be writable is, what must not is not.
 * @param {any} r @param {string} runtimeDir
 * @returns {string[]} findings, empty when the boundary holds
 */
export function judgeProbe(r: any, runtimeDir: string): string[];
/**
 * Run the probe inside the sandbox. `unavailable` when the driver could not start at all.
 * @param {Sandbox} sb @param {Plan} plan
 * @returns {{ findings: string[], unavailable: string }}
 */
export function probeSandbox(sb: Sandbox, plan: Plan): {
    findings: string[];
    unavailable: string;
};
/**
 * Build and prove the night's sandbox. Never throws for a refused night: `refuse` carries the
 * reason; `note` is the line the runner logs either way.
 * @param {any} config
 * @param {{ repoDir: string, folder: string, nightDir: string, mode?: string }} c
 * @returns {Prepared}
 */
export function prepareSandbox(config: any, c: {
    repoDir: string;
    folder: string;
    nightDir: string;
    mode?: string;
}): Prepared;
/** @typedef {import("./sandbox-drivers.mjs").Sandbox} Sandbox */
/** @typedef {import("./sandbox-drivers.mjs").Plan} Plan */
/**
 * @typedef {{ mode: "auto" | "required" | "off", driver: string, command: string, image: string, readOnly: string[], writable: string[], env: string[], home: string }} SandboxConfig
 * @typedef {{ driver: string, sandbox: Sandbox | null, note: string, refuse: string }} Prepared
 */
export const MODES: string[];
export const DRIVERS: string[];
export type Sandbox = import("./sandbox-drivers.mjs").Sandbox;
export type Plan = import("./sandbox-drivers.mjs").Plan;
export type SandboxConfig = {
    mode: "auto" | "required" | "off";
    driver: string;
    command: string;
    image: string;
    readOnly: string[];
    writable: string[];
    env: string[];
    home: string;
};
export type Prepared = {
    driver: string;
    sandbox: Sandbox | null;
    note: string;
    refuse: string;
};
