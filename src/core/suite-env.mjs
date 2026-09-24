/**
 * The rest of the environment a suite's server needs, beside its database. hermetic.mjs gives a
 * suite a database of the run's own; an adopter's browser suite then went red on 96 journeys in a
 * fresh checkout, every one "Not authenticated", because the server under test had no auth
 * secret: CI sets placeholder values in the workflow, and a laptop had them only in a `.env` the
 * checkout lacked. The failure read as broken journeys. The names the repository's example env
 * file declares are the list of what the server reads; one set nowhere this run can see is said
 * before the suite starts, and the config can give a suite non-secret values of its own.
 *
 * Names only: no file's values are read, the example's included.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOTENV } from "./hermetic.mjs";
import { envNames } from "./env.mjs";
import { readConfig } from "./repo.mjs";

/** The files a repository documents its environment in, by the names the ecosystems use. */
const EXAMPLES = [".env.example", ".env.sample", ".env.template", "env.example", "example.env"];
/** The database is hermetic.mjs's to give; these are never a gap here. */
const HANDLED = new Set(["DATABASE_URL", "TEST_DATABASE_URL"]);

/** The variable names a dotenv-shaped file declares. @param {string} path */
function namesIn(path) {
  if (!existsSync(path)) return [];
  return [...readFileSync(path, "utf8").matchAll(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/gm)].map(
    (m) => String(m[1]),
  );
}

/**
 * The names the example env file declares that neither this shell, a dotenv file the framework
 * loads, nor the config's `suiteEnv` supplies, read in the folders a suite runs from. Empty in CI,
 * whose workflow is where a pipeline's environment is written.
 * @param {string[]} dirs @param {{ ci?: boolean, declared?: Record<string, string> }} [o]
 * @returns {string[]}
 */
export function suiteEnvGaps(dirs, o = {}) {
  if (o.ci) return [];
  const folders = [...new Set(dirs)];
  const wanted = new Set(folders.flatMap((d) => EXAMPLES.flatMap((f) => namesIn(join(d, f)))));
  const have = new Set([
    ...envNames(),
    ...Object.keys(o.declared || {}),
    ...folders.flatMap((d) => DOTENV.flatMap((f) => namesIn(join(d, f)))),
  ]);
  return [...wanted].filter((n) => !have.has(n) && !HANDLED.has(n)).sort();
}

/**
 * The config's `suiteEnv`: non-secret values a suite runs with, as a pipeline's workflow gives
 * them. A value that is not a string is left out rather than coerced.
 * @param {string} repoDir @returns {Record<string, string>}
 */
export function suiteEnvOf(repoDir) {
  const raw = readConfig(repoDir)?.suiteEnv;
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string"));
}
