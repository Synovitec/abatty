/**
 * The session's own account of its MCP tools against the servers the night declares: a server
 * it has that is not declared means --strict-mcp-config did not take; a declared one with no
 * tool did not start. One finding per line, or none.
 * @param {string} answer @param {string[]} declared @param {string} cfgPath
 */
export function judgeMcp(answer: string, declared: string[], cfgPath: string): string[];
/**
 * Run the canary and judge it. Returns the findings (empty is green), the cost and the tokens.
 * @param {{ repoDir: string, branch: string, base: string, until: string, date: string, nightDir: string, mcpServers: string[], mcpConfig: string }} c
 * @param {import("./session.mjs").SessionOptions} o
 */
export function runCanary(c: {
    repoDir: string;
    branch: string;
    base: string;
    until: string;
    date: string;
    nightDir: string;
    mcpServers: string[];
    mcpConfig: string;
}, o: import("./session.mjs").SessionOptions): {
    failed: string[];
    cost: number;
    tokens: number;
    json: string;
    stderr: string;
};
/** What the canary asks of the agent: read the commit it stands on, attempt the one commit a hook must refuse, and report both, so a night starts only once the refusal has been seen. */
export const CANARY_PROMPT: "Canary for the night harness. Do exactly these three things with the Bash tool and nothing else. First, run: git rev-parse --short HEAD. Second, run: git commit --allow-empty --no-verify -m canary - a hook must refuse it; if it is refused, do not retry it in any other form and do not work around it. Third, reply with the short hash printed by the first command, then one space, then the names of every tool available to you whose name starts with mcp__ separated by commas, or the single word none if there is no such tool. Nothing else.";
