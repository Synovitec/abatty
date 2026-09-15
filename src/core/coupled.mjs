/**
 * Coupled paths: "when this changes, that changes in the same push", declared as pairs of
 * paths (a prefix, or a glob with `*` and `**`) and judged over a range of commits. One
 * mechanism, three uses: the changelog (a source commit is followed or accompanied by a
 * changelog touch), a schema and its migration, an API and its client, a document and the
 * code it describes. The rule is per commit and monotone: a commit that touches a `when` path
 * without a `then` path is an offender until a later commit of the range touches the `then`
 * path, so the cure is always a new commit, never a rewrite.
 */

/** @typedef {{ when: string[], then: string[], why: string }} Pair */
/** @typedef {{ sha: string, subject: string, files: string[] }} Commit chronological order */
/** @typedef {{ path: string, detail: string }} Offender */

/**
 * A matcher for a path pattern: a prefix (`src/`, `docs/AUTH.md`), or a glob where `*` is a
 * segment and `**` any depth. Forward slashes only.
 * @param {string} pattern @returns {(path: string) => boolean}
 */
export function pathMatcher(pattern) {
  const p = String(pattern).replace(/\\/g, "/");
  if (!/[*?]/.test(p)) return (path) => path === p || path.startsWith(p) || path.includes(`/${p}`);
  let re = "^";
  for (let i = 0; i < p.length; i++) {
    const ch = p.charAt(i);
    if (ch === "*" && p.charAt(i + 1) === "*") {
      if (p.charAt(i + 2) === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
  }
  return (path) => new RegExp(re + "$").test(path);
}

/** @param {unknown} v @returns {string[]} */
const list = (v) =>
  Array.isArray(v) ? v.map(String) : v === undefined || v === null ? [] : [String(v)];

/**
 * The pairs a config declares, normalised; a pair without a `when` or a `then` is dropped.
 * @param {unknown} declared @returns {Pair[]}
 */
export function normalisePairs(declared) {
  if (!Array.isArray(declared)) return [];
  return declared
    .map((/** @type {any} */ d) => ({
      when: list(d?.when),
      then: list(d?.then),
      why: String(d?.why || ""),
    }))
    .filter((p) => p.when.length && p.then.length);
}

/**
 * The offenders of a range: for each pair, every commit touching a `when` path and not a
 * `then` path, unless a later commit of the range touches a `then` path.
 * @param {Commit[]} commits @param {Pair[]} pairs @returns {Offender[]}
 */
export function coupledFindings(commits, pairs) {
  /** @type {Offender[]} */
  const out = [];
  for (const pair of pairs) {
    const whenHit = pair.when.map(pathMatcher);
    const thenHit = pair.then.map(pathMatcher);
    /** @type {Offender[]} */
    let pending = [];
    for (const c of commits) {
      const touchesThen = c.files.some((f) => thenHit.some((m) => m(f)));
      if (touchesThen) {
        pending = [];
        continue;
      }
      const hit = c.files.filter((f) => whenHit.some((m) => m(f)));
      if (hit.length)
        pending.push({
          path: c.sha,
          detail: `${c.subject}: ${hit[0]}${hit.length > 1 ? ` (+${hit.length - 1})` : ""} changed, ${pair.then.join(" or ")} not touched after it${pair.why ? ` (${pair.why})` : ""}`,
        });
    }
    out.push(...pending);
  }
  return out;
}

/**
 * The changelog rule as a pair: the source prefixes, then the changelog.
 * @param {{ changelog: string, changelogRequiredFor: string[] }} c @returns {Pair[]}
 */
export function changelogPairs(c) {
  return [
    {
      when: c.changelogRequiredFor,
      then: [c.changelog],
      why: "a change is written in the changelog of the same push",
    },
  ];
}

/**
 * The commits of a range as the mechanism reads them, oldest first.
 * @param {(...args: string[]) => string} git @param {string} range
 * @returns {Commit[]}
 */
export function commitsOf(git, range) {
  const log = git("log", "--reverse", "--no-merges", "--format=%h%x00%s", range);
  if (!log) return [];
  return log.split("\n").map((l) => {
    const [sha, subject] = l.split("\0");
    return {
      sha: String(sha),
      subject: String(subject || ""),
      files: git("show", "--name-only", "--format=", String(sha)).split("\n").filter(Boolean),
    };
  });
}
