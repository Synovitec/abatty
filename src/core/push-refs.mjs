/**
 * What a push actually carries, read from the lines git hands a pre-push hook on stdin:
 * `<local ref> <local sha> <remote ref> <remote sha>`, one per ref. The gate judged whatever was
 * checked out, whatever was pushed: an adopter deleting three branches ran the full gate, build
 * and browser suite included, on the branch it happened to stand on; a push of another branch
 * was judged by the checkout's tree; a push of two refs judged one. So each line is read:
 *
 *   a deletion (the local sha is all zeros)  nothing to verify: said, and skipped
 *   a tag                                    it names commits a branch push already judged: skipped
 *   the commit checked out                   judged, over the range the push adds
 *   any other commit                         refused, loudly: the gate judges a tree, and the
 *                                            tree here is not the one being pushed
 */

const ZERO = /^0+$/;

/**
 * @typedef {{ local: string, localSha: string, remote: string, remoteSha: string }} PushLine
 * @typedef {{ judge: PushLine[], skipped: string[], refused: string[] }} PushPlan
 */

/** The lines a pre-push hook receives, parsed; malformed lines are dropped. @param {string} text @returns {PushLine[]} */
export function pushLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 4)
    .map(([local = "", localSha = "", remote = "", remoteSha = ""]) => ({
      local,
      localSha,
      remote,
      remoteSha,
    }));
}

/**
 * What to do with each ref of a push, against the commit checked out here.
 * @param {PushLine[]} lines @param {string} head the checked-out commit's sha
 * @returns {PushPlan}
 */
export function pushPlan(lines, head) {
  /** @type {PushPlan} */
  const plan = { judge: [], skipped: [], refused: [] };
  for (const l of lines) {
    if (ZERO.test(l.localSha))
      plan.skipped.push(`${l.remote}: a deletion carries nothing to verify`);
    else if (l.local.startsWith("refs/tags/") || l.remote.startsWith("refs/tags/"))
      plan.skipped.push(`${l.remote}: a tag names commits a branch push is judged on`);
    else if (l.localSha === head) plan.judge.push(l);
    else
      plan.refused.push(
        `${l.local} → ${l.remote} is ${l.localSha.slice(0, 12)}, not the ${head.slice(0, 12)} checked out here: the gate judges the tree it stands on, so push it from where it is checked out (its worktree, or after checking it out)`,
      );
  }
  return plan;
}

/**
 * The range a judged ref adds: from what the remote had, or from where the branch left `base`
 * for a new branch (the remote sha all zeros).
 * @param {PushLine} l @param {string} mergeBase the merge base with the base branch, "" when none
 */
export function refRange(l, mergeBase) {
  if (!ZERO.test(l.remoteSha)) return `${l.remoteSha}..${l.localSha}`;
  return mergeBase ? `${mergeBase}..${l.localSha}` : "";
}
