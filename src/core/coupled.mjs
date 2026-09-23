/**
 * Coupled paths: "when this changes, that changes in the same push", declared as pairs of
 * paths (a prefix, or a glob with `*` and `**`) and judged over a range of commits. One
 * mechanism, three uses: the changelog (a source commit is followed or accompanied by a
 * changelog touch), a schema and its migration, an API and its client, a document and the
 * code it describes. The rule is per commit and monotone: a commit that touches a `when` path
 * without a `then` path is an offender until a later commit of the range touches the `then`
 * path, so the cure is always a new commit, never a rewrite.
 */

/** @typedef {{ when: string[], then: string[], why: string, excuse?: RegExp }} Pair `excuse`: a line in a commit's message that stands for the counterpart, said rather than done */
/** @typedef {{ sha: string, subject: string, body?: string, files: string[] }} Commit chronological order */
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
      // A commit whose message says why the counterpart is untouched is a decision on the
      // record, and the same line the commit-msg hook accepted: refusing it a push later would
      // make the hook's escape a promise the range check breaks. It excuses itself alone; it
      // cures nothing before it.
      if (pair.excuse && pair.excuse.test(c.body || "")) continue;
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
 * The same rule at commit time, on the staged files: a commit that touches a `when` path
 * carries a `then` path or says why it does not. Judged before the commit exists rather than a
 * push later, because a rule that refuses the push after the fact punishes pushes, and one that
 * refuses the commit shapes commits (an outside trial hit the push-time refusal four times in
 * two days, each a commit too late). A message line `no-changelog: <reason>` is the decision on
 * the record and passes; the bypass reading counts the same line as reasoned.
 * @param {string[]} staged @param {Pair[]} pairs @param {string} [message]
 * @returns {{ ok: boolean, detail: string }}
 */
export function stagedVerdict(staged, pairs, message = "") {
  const excused = REASON.test(message);
  for (const pair of pairs) {
    const whenHit = pair.when.map(pathMatcher);
    const thenHit = pair.then.map(pathMatcher);
    if (staged.some((f) => thenHit.some((m) => m(f)))) continue;
    const hit = staged.filter((f) => whenHit.some((m) => m(f)));
    if (!hit.length) continue;
    if (excused)
      return { ok: true, detail: `${pair.then.join(" or ")} not staged; the message says why` };
    return {
      ok: false,
      detail: `${hit.length} staged file(s) under ${pair.when.join(", ")} (${hit[0]}${hit.length > 1 ? `, +${hit.length - 1}` : ""}) and ${pair.then.join(" or ")} is not staged${pair.why ? ` (${pair.why})` : ""}`,
    };
  }
  return { ok: true, detail: "" };
}

/** A message that says why the counterpart is untouched: a decision, not a hole. */
export const REASON = /^\s*no-changelog:\s*\S/im;

/**
 * The changelog rule as a pair: the source prefixes, then the changelog, or a fragment in the
 * folder a repository keeps them in (src/core/fragments.mjs), which is the same rule without the
 * shared hunk every parallel branch edits.
 * @param {{ changelog: string, changelogRequiredFor: string[], changelogFragments?: string }} c @returns {Pair[]}
 */
export function changelogPairs(c) {
  return [
    {
      when: c.changelogRequiredFor,
      then: [
        c.changelog,
        ...(c.changelogFragments ? [`${c.changelogFragments.replace(/\/+$/, "")}/`] : []),
      ],
      why: "a change is written in the changelog of the same push",
      excuse: REASON,
    },
  ];
}

/**
 * The commits of a range as the mechanism reads them, oldest first.
 * @param {(...args: string[]) => string} git @param {string} range
 * @returns {Commit[]}
 */
export function commitsOf(git, range) {
  // The whole message, one record per commit on a separator no message carries: the excuse a
  // pair accepts is a line of the body, and the subject alone could not show it.
  const log = git("log", "--reverse", "--no-merges", "--format=%h%x00%s%x00%B%x1e", range);
  if (!log) return [];
  return log
    .split("\x1e")
    .map((r) => r.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((r) => {
      const [sha, subject, body] = r.split("\0");
      return {
        sha: String(sha),
        subject: String(subject || ""),
        body: String(body || ""),
        files: git("show", "--name-only", "--format=", String(sha)).split("\n").filter(Boolean),
      };
    });
}
