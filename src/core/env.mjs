/**
 * The one place the package reads its environment (standard VALID-3): every other module asks
 * here, so a variable that changes meaning changes in one file. Only what the package itself
 * needs; the hooks and the stub keep their own reads, they run inside another repository.
 */

/** The agent's executable named by the environment, or "". */
export function agentFromEnv() {
  return process.env.ABATTY_AGENT || "";
}
