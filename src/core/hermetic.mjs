/**
 * Which database a suite may touch. A database or browser suite on a laptop inherits the
 * developer's `DATABASE_URL`, from the shell or from `.env`, and that is the database they work
 * against, sometimes production's. An outside trial's pre-push gate ran its browser suite there:
 * it went red on data that had drifted, wrote real orders, and created administrator accounts
 * with a known password that a killed run would have left behind. The gate is the one caller that
 * must never do that, so a suite gets a database the run owns or does not run:
 *
 *   TEST_DATABASE_URL set      the suite runs with DATABASE_URL pointed at it, and so does every
 *                              other step (stepDatabase): a tool that reads DATABASE_URL to
 *                              load its config went red when a developer unset it to comply
 *   in CI                      the pipeline's DATABASE_URL is its own service: trusted
 *   an ambient DATABASE_URL    deferred to CI, loudly, with how to give it a database of its own
 *   no database named at all   the suite runs as it is, starting whatever it starts itself
 *
 * `.env` files are read for the NAME only: whether they declare DATABASE_URL, never its value.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { databaseFromEnv } from "./env.mjs";

/** The dotenv files a framework loads for a development run or a build, in the order it reads them. */
const DOTENV = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
];

/**
 * @typedef {{ ok: true, env: Record<string, string> } | { ok: false, reason: string }} SuiteDatabase
 *   `env`: the variables the suite's steps run with, on top of this process's.
 */

/**
 * Which dotenv file under the folders declares DATABASE_URL, as a path, or "". Reads key names,
 * not values. The repository root and a workspace are both read: a suite loads either.
 * @param {string[]} dirs
 */
function declaredIn(dirs) {
  for (const dir of [...new Set(dirs)])
    for (const f of DOTENV) {
      const path = join(dir, f);
      if (
        existsSync(path) &&
        /^\s*(?:export\s+)?DATABASE_URL\s*=/m.test(readFileSync(path, "utf8"))
      )
        return path;
    }
  return "";
}

/**
 * The database every step of the gate runs with: TEST_DATABASE_URL, as DATABASE_URL, when one is
 * named, since its value is known to be the run's own; nothing otherwise. A step outside the
 * suites that reads DATABASE_URL (a dead-code tool loading the ORM's config) went red for a
 * developer who unset their own DATABASE_URL on the deferral's advice.
 * @param {{ url: string, test: string }} [db]
 * @returns {Record<string, string>}
 */
export function stepDatabase(db = databaseFromEnv()) {
  return db.test ? { DATABASE_URL: db.test } : {};
}

/**
 * The database a suite may run against, read in the folders it runs from.
 * @param {string[]} dirs @param {{ ci?: boolean, db?: { url: string, test: string } }} [o]
 * @returns {SuiteDatabase}
 */
export function suiteDatabase(dirs, o = {}) {
  const db = o.db || databaseFromEnv();
  if (db.test) return { ok: true, env: { DATABASE_URL: db.test } };
  if (o.ci) return { ok: true, env: {} };
  const file = declaredIn(dirs);
  if (db.url || file)
    return {
      ok: false,
      reason: `DATABASE_URL ${db.url ? "is set in this shell" : `is declared in ${file}`}, a database this run did not create: keep it for the tools that read it, and point TEST_DATABASE_URL at a throwaway one (a database in the container the integration suite starts will do): the gate then gives every step that one as DATABASE_URL, and the suite runs here`,
    };
  return { ok: true, env: {} };
}
