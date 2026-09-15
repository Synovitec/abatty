/**
 * The one place the package reads its environment (standard VALID-3): every other module asks
 * here, so a variable that changes meaning changes in one file. Only what the package itself
 * needs; the hooks and the stub keep their own reads, they run inside another repository.
 */

/** The agent's executable named by the environment, or "". */
export function agentFromEnv() {
  return process.env.ABATTY_AGENT || "";
}

/** The hosted dashboard's bearer token, or "". */
export function tokenFromEnv() {
  return process.env.ABATTY_TOKEN || "";
}

/** The hosted dashboard's URL for `publish`, or "". */
export function dashboardFromEnv() {
  return process.env.ABATTY_DASHBOARD || "";
}

/** The port the service listens on when none is given, or "". */
export function portFromEnv() {
  return process.env.PORT || "";
}
