/**
 * @typedef {{ exit: number, crashed: boolean, parsed: boolean, cost: number, denials: number, sessionId: string, isError: boolean, result: string, json: string, stderr: string }} SessionResult
 * @typedef {{ agent: string, mode: string, model: string, effort: string, mcpConfig: string, log: (line: string) => void, adapter?: import("../agents/index.mjs").Adapter, sandbox?: import("./sandbox-drivers.mjs").Sandbox | null }} SessionOptions
 */
/**
 * The agent's executable, from the machine that runs the night, never from the repository:
 * the explicit option, else ABATTY_AGENT, else `agent.command` in ~/.abatty/config.json.
 * @param {string} [explicit]
 */
export function agentCommand(explicit?: string): any;
/**
 * The deadline: "HH:MM" is today at that hour, tomorrow when it is already past; "+Nmin" or
 * "+Nh" is relative to now. Returns epoch milliseconds.
 * @param {string} until @param {Date} [now]
 */
export function deadlineOf(until: string, now?: Date): number;
/**
 * Run one session. Output goes to `<outBase>.json` and `<outBase>.stderr.txt`; the env carries
 * the night's variables for the hooks. Runs through a shell on Windows only (a `.cmd` shim
 * needs one); elsewhere the executable is called directly, so a prompt starting with "/" is
 * never rewritten into a path. With a sandbox, the executable and its arguments go through the
 * driver's argv: the session runs inside the boundary, the hooks with it.
 * @param {{ repoDir: string, prompt: string, budget: number, name: string, outBase: string, env: Record<string, string | undefined> }} run
 * @param {SessionOptions} o
 * @returns {SessionResult}
 */
export function runSession(run: {
    repoDir: string;
    prompt: string;
    budget: number;
    name: string;
    outBase: string;
    env: Record<string, string | undefined>;
}, o: SessionOptions): SessionResult;
/** HH:MM for the log. */
export function clock(): string;
export type SessionResult = {
    exit: number;
    crashed: boolean;
    parsed: boolean;
    cost: number;
    denials: number;
    sessionId: string;
    isError: boolean;
    result: string;
    json: string;
    stderr: string;
};
export type SessionOptions = {
    agent: string;
    mode: string;
    model: string;
    effort: string;
    mcpConfig: string;
    log: (line: string) => void;
    adapter?: import("../agents/index.mjs").Adapter;
    sandbox?: import("./sandbox-drivers.mjs").Sandbox | null;
};
