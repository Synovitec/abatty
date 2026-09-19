/**
 * `abatty validate`: which of these rules, in THIS repository's history, actually precede the
 * commits that fix defects.
 *
 * Every rule in the catalog carries a `why`. A `why` is an argument, and an argument is not
 * evidence. This asks the only question that can be answered from a repository alone: do the
 * files that break a rule turn out to be the files somebody later had to fix?
 *
 * WHAT IT CANNOT SAY, and says so on every reading:
 *
 *   - It is a correlation. A rule that scores well here has not been shown to CAUSE anything.
 *   - Churn is the obvious confounder and is reported beside every number rather than removed: a
 *     file that changes constantly attracts both fixes and violations, and a rule that merely
 *     tracks churn will look excellent. The commits-per-file figure is there so a reader can see
 *     that happening.
 *   - It reads the tree as it is TODAY against fixes from the whole range, so a file that was
 *     fixed and then cleaned up counts against the rule. That direction of error is deliberate:
 *     it makes a rule look worse than it is, never better.
 *   - It is one repository. Nothing here generalises, and the output says which repository and
 *     how many commits it read.
 *
 * A number on six files is noise, so a probe under the sample floor reports "too few" rather
 * than a lift nobody should act on.
 */

/** A commit subject that is somebody fixing something that was wrong. */
const FIXING =
  /^(fix|hotfix|bugfix|revert)(\(|:|!)|\b(fix|fixes|fixed|bug|regression|broken|crash|hotfix)\b/i;

/** Below this many files on either side, a rate is noise and is reported as noise. */
export const SAMPLE_FLOOR = 8;

/**
 * The files each fixing commit touched, and how many commits touched each file at all.
 * @param {(...args: string[]) => string} git
 * @param {string} range "" for the whole history
 * @returns {{ fixed: Map<string, number>, churn: Map<string, number>, commits: number, fixes: number }}
 */
export function fixHistory(git, range) {
  const args = ["log", "--no-merges", "--name-only", "--format=%x00%s"];
  if (range) args.push(range);
  const out = git(...args);
  /** @type {Map<string, number>} */
  const fixed = new Map();
  /** @type {Map<string, number>} */
  const churn = new Map();
  let commits = 0;
  let fixes = 0;
  for (const block of out.split("\u0000")) {
    if (!block.trim()) continue;
    const [subject = "", ...rest] = block.split("\n");
    commits++;
    const isFix = FIXING.test(subject.trim());
    if (isFix) fixes++;
    for (const f of rest.map((x) => x.trim()).filter(Boolean)) {
      churn.set(f, (churn.get(f) || 0) + 1);
      if (isFix) fixed.set(f, (fixed.get(f) || 0) + 1);
    }
  }
  return { fixed, churn, commits, fixes };
}

/** The mean of a list, or 0. @param {number[]} xs */
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * One probe against the history: of the files it reports today, how many were ever touched by a
 * fixing commit, against the same rate among the files it does not report.
 * @param {{ metric: string, findings: { path: string }[], scanned: string[] }} probe
 * @param {ReturnType<typeof fixHistory>} history
 */
export function probeAgainstHistory(probe, history) {
  const violating = [...new Set(probe.findings.map((f) => f.path))].filter((p) =>
    history.churn.has(p),
  );
  const clean = probe.scanned.filter((p) => !violating.includes(p) && history.churn.has(p));
  /** @param {string[]} files */
  const rate = (files) =>
    files.length ? files.filter((f) => history.fixed.has(f)).length / files.length : 0;
  const v = rate(violating);
  const c = rate(clean);
  const enough = violating.length >= SAMPLE_FLOOR && clean.length >= SAMPLE_FLOOR;
  return {
    metric: probe.metric,
    violating: {
      files: violating.length,
      everFixed: violating.filter((f) => history.fixed.has(f)).length,
      rate: Math.round(100 * v),
      churn: Number(mean(violating.map((f) => history.churn.get(f) || 0)).toFixed(1)),
    },
    clean: {
      files: clean.length,
      everFixed: clean.filter((f) => history.fixed.has(f)).length,
      rate: Math.round(100 * c),
      churn: Number(mean(clean.map((f) => history.churn.get(f) || 0)).toFixed(1)),
    },
    // Null, not zero, below the floor: a lift of 0 reads as "no effect" and this is "no idea".
    lift: enough ? Math.round(100 * (v - c)) : null,
    verdict: !enough
      ? `too few files to say (needs ${SAMPLE_FLOOR} on each side, has ${violating.length} and ${clean.length})`
      : v > c
        ? "files breaking this rule were fixed more often here"
        : v < c
          ? "files breaking this rule were fixed LESS often here, which is evidence against it"
          : "no difference here",
  };
}

/** The caveats, carried with the numbers so they cannot be quoted without them. */
export const CAVEATS = [
  "A correlation, not a cause. Nothing here shows a rule prevented anything.",
  "Churn is reported beside every rate rather than removed: a rule that merely tracks how often a file changes will look excellent, and the commits-per-file column is where you see that.",
  "The tree is read as it is today against fixes from the whole range, so a file that was fixed and then cleaned up counts against the rule. That error runs one way: it flatters nothing.",
  "One repository, and the reading says which. Nothing here generalises to yours.",
];
