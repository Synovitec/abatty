/**
 * The files the ratchet does not see because git does not track them yet. The ratchet reads the
 * tracked tree on purpose (src/rules/context.mjs), so a floor never moves on a file nobody
 * commits; the cost was that a baseline written over new, uncommitted sources recorded a floor
 * without them, and the push that committed them was refused by the ratchet it had just locked.
 * An adopter's session lost a push to that and found nothing had said so.
 */
import { buildContext } from "../rules/context.mjs";

/**
 * The untracked, not-ignored files a probe would read once committed: sources and tests of
 * every detected language, and the documents under docs/. Ignored files are not listed; they
 * never reach a push.
 * @param {string} repoDir @param {import("../rules/context.mjs").RepoContext} tracked the ratchet's context, built with `tracked`
 * @returns {string[]}
 */
export function untrackedInScope(repoDir, tracked) {
  const whole = buildContext(repoDir, { today: tracked.today });
  const have = new Set(tracked.allFiles);
  const docs = new Set(whole.docFiles);
  return whole.allFiles.filter(
    (f) =>
      !have.has(f) &&
      !f.startsWith(whole.agentRoot + "/") &&
      (docs.has(f) || whole.packs.some((p) => p.source.test(f) || p.test.test(f))),
  );
}

/**
 * The sentence both commands print, or null when nothing is left out. @param {string[]} files
 * @param {"ratchet" | "baseline"} command
 */
export function untrackedLine(files, command) {
  if (!files.length) return null;
  const some = files.slice(0, 5).join(", ") + (files.length > 5 ? `, +${files.length - 5}` : "");
  return command === "baseline"
    ? `${files.length} untracked file(s) the probes would read are not in this floor: ${some}. The floor is the tracked tree; add them (git add) and run baseline again, or the push that commits them is measured against a floor that never saw them`
    : `${files.length} untracked file(s) the probes would read are not measured: ${some}. The ratchet reads the tracked tree; the push that commits them is where they count`;
}
