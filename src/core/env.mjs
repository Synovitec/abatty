/**
 * The one place the package reads its environment (standard VALID.3): every other module asks
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

/** The executable search path, or "": what a run's subprocesses will find, shim included. */
export function pathFromEnv() {
  return process.env.PATH || "";
}

/**
 * What a shell reads to find a program: the search path (Windows spells it `Path` as often as
 * `PATH`) and the executable extensions. The two variables, not the whole environment.
 */
export function searchFromEnv() {
  return { PATH: process.env.PATH ?? process.env.Path ?? "", PATHEXT: process.env.PATHEXT ?? "" };
}

/**
 * The databases the environment names: the application's (`DATABASE_URL`, which on a laptop is
 * whatever the developer works against) and a throwaway one for suites (`TEST_DATABASE_URL`).
 */
export function databaseFromEnv() {
  return { url: process.env.DATABASE_URL || "", test: process.env.TEST_DATABASE_URL || "" };
}

/**
 * A child's environment: this process's, with `extra` over it, or undefined when there is nothing
 * to add (the child then inherits, which is spawn's default). The one place the package hands
 * the whole environment on.
 * @param {Record<string, string>} extra @returns {NodeJS.ProcessEnv | undefined}
 */
export function childEnv(extra) {
  return Object.keys(extra).length ? { ...process.env, ...extra } : undefined;
}

/** The port the service listens on when none is given, or "". */
export function portFromEnv() {
  return process.env.PORT || "";
}

/** True on a CI runner (every provider sets CI): a gate run there cannot read the push from git. */
export function ciFromEnv() {
  return Boolean(process.env.CI);
}
