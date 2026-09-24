/**
 * Whether an agent's settings still refuse it the secret files, judged by what the deny rules
 * match rather than by how they are spelled. An adopter narrowed `Read(./.env.*)` to eight named
 * files so an allow for `.env.example` could work (a deny beats an allow); every daytime check
 * stayed green, because the rule looked for words and doctor called it drift, while
 * `.env.staging`, `.env.prod` and `.env.local.bak` became readable. The question is asked of
 * names planted for it: would these rules refuse a read of each?
 */

/**
 * The names a secret-read deny must cover: the env file, the spellings of its variants a
 * repository grows (a stage, a backup, a platform's pull), whether or not they exist today.
 */
export const SECRET_NAMES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.staging",
  ".env.prod",
  ".env.backup",
  ".env.local.bak",
  ".env.vercel",
];

/**
 * A permission rule's path glob as a pattern over a repository-relative path: `*` stays within a
 * folder, `**` crosses folders, a leading `./` or a single `/` is the project root (`//` is the
 * filesystem's, and is not read here). What the agent's settings mean by one.
 * @param {string} glob @returns {RegExp}
 */
function globPattern(glob) {
  const g = glob.replace(/^\.?\//, "");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const ch = String(g[i]);
    if (ch === "*" && g[i + 1] === "*") {
      re += g[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += g[i + 2] === "/" ? 2 : 1;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * The path globs of the `Read(...)` rules in a settings object's `permissions.deny`.
 * @param {any} settings @returns {string[]}
 */
export function readDenies(settings) {
  /** @type {unknown[]} */
  const deny = Array.isArray(settings?.permissions?.deny) ? settings.permissions.deny : [];
  return deny
    .map((d) => /^Read\((.+)\)$/.exec(String(d))?.[1] || "")
    .filter((g) => g && !g.startsWith("~") && !g.startsWith("//"));
}

/**
 * The secret names a settings object would let the agent read.
 * @param {any} settings @returns {string[]}
 */
export function unrefusedSecrets(settings) {
  const patterns = readDenies(settings).map(globPattern);
  return SECRET_NAMES.filter((n) => !patterns.some((p) => p.test(n)));
}

/**
 * The deny rules `shipped` carries that `installed` does not, and the allow rules `installed`
 * added: what a reader needs to see when a settings file differs from the template, named rather
 * than called drift.
 * @param {any} shipped @param {any} installed
 */
export function loosenedRules(shipped, installed) {
  const list = (/** @type {any} */ s, /** @type {string} */ k) =>
    Array.isArray(s?.permissions?.[k]) ? s.permissions[k].map(String) : [];
  const has = new Set(list(installed, "deny"));
  const had = new Set(list(shipped, "allow"));
  return {
    removedDenies: list(shipped, "deny").filter((d) => !has.has(d)),
    addedAllows: list(installed, "allow").filter((a) => !had.has(a)),
  };
}
