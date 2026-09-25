/**
 * What `abatty update` does to the git hooks, apart from the managed files because a hook has no
 * installed copy to merge from: it is refreshed when it is the one last written or a form an
 * earlier init wrote, kept when the repository edited it and the package offers the same hook it
 * offered before, and otherwise given the new version beside it as `.abatty-new`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeExecutable } from "./init.mjs";
import { gitHooks, writtenByInit } from "./git-hooks.mjs";
import { managerFor } from "./package-manager.mjs";

/**
 * The git hooks brought to this version, as update events. Only init wrote them once, so an
 * adopter who upgraded kept a pre-push hook from before --refs while doctor said no drift; a
 * repository whose hooks live elsewhere (no .githooks folder) is left alone.
 * @param {{ repoDir: string, lock: import("./update.mjs").Lock | null, force: boolean, dryRun: boolean, hash: (text: string) => string }} o
 * @returns {import("./update.mjs").UpdateEvent[]}
 */
export function refreshGitHooks(o) {
  const { repoDir, lock, force, dryRun, hash } = o;
  /** @type {import("./update.mjs").UpdateEvent[]} */
  const events = [];
  if (!existsSync(join(repoDir, ".githooks"))) return events;
  for (const [rel, text] of Object.entries(gitHooks(managerFor(repoDir)))) {
    const target = join(repoDir, rel);
    const ours = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (ours !== null && hash(ours) === hash(text)) {
      events.push({ file: rel, action: "in step" });
      continue;
    }
    const untouched =
      ours === null || force || lock?.hooks?.[rel] === hash(ours) || writtenByInit(rel, ours);
    if (untouched) {
      if (!dryRun) {
        writeFileSync(target, text);
        makeExecutable(target);
      }
      events.push({
        file: rel,
        action: ours === null ? "added" : "updated",
        detail: ours === null ? undefined : "the hook as this version writes it",
      });
      continue;
    }
    // Offered before and unchanged since: a replay of 0.7.0-rc.1 met every custom hook as a
    // conflict, on every update, for a hook the package had not changed in two versions.
    if (lock?.offered?.[rel] === hash(text)) {
      events.push({
        file: rel,
        action: "kept",
        detail: "yours; the hook this version writes is the one offered before, unchanged",
      });
      continue;
    }
    if (!dryRun) writeFileSync(`${target}.abatty-new`, text);
    events.push({
      file: rel,
      action: "conflict",
      detail: `edited here: the hook this version writes is beside yours as ${rel}.abatty-new`,
    });
  }
  return events;
}
