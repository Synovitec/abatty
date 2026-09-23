/**
 * The three git hooks the instrument installs under `.githooks/`, in one place for the three
 * commands that read them: `init` writes them, `update` refreshes them, `doctor` compares them.
 *
 * They are generated rather than copied, because they speak the repository's own package manager.
 * Only `init` knew how, so `update` never touched them: an adopter who upgraded kept a pre-push
 * hook from before `--refs` (the gate judging the checkout rather than the push) and `npm run` on
 * a pnpm repository, while `doctor` reported no drift at all.
 */
import { git } from "./repo.mjs";

/**
 * The hooks as this version writes them.
 * @param {{ run: (script: string, args?: string[]) => string[], exec: (bin: string) => string[] }} pm
 * @returns {Record<string, string>} path to content
 */
export function gitHooks(pm) {
  const abatty = pm.exec("abatty").join(" ");
  const installed = `Installed by \`${pm.run("hooks:install").join(" ")}\`.`;
  return {
    ".githooks/pre-commit": `#!/bin/sh\n# The secret scan over the staged files, the same implementation the gate and CI run. ${installed}\n${abatty} secrets --staged\n`,
    // --refs: git hands the pushed refs on stdin, and the gate judges that push rather than
    // whatever happens to be checked out (a branch deletion ran the whole gate before).
    ".githooks/pre-push": `#!/bin/sh\n# One implementation, two callers: this hook and \`${pm.run("gate").join(" ")}\`. ${installed}\n${pm.run("gate", ["--refs"]).join(" ")}\n`,
    // The scrub refuses a message that names a tool where the repository opted in (a no-op
    // otherwise), and the changelog rule runs in the same hook, before the commit exists.
    ".githooks/commit-msg": `#!/bin/sh\n# Refuses a commit message that names a tool where scrub.enabled is on (a no-op otherwise), and a\n# source commit whose changelog line is not staged with it (CHANGE.1; \`no-changelog: <reason>\` in the message excuses it).\n${abatty} scrub --message "$1" && ${abatty} changelog --message "$1"\n`,
  };
}

/** A command an earlier version of `init` wrote into one of the hooks, in any manager's words. */
const X = "(npx |pnpm exec |yarn exec |yarn |bunx |bun x )?abatty";
const EARLIER = /** @type {Record<string, RegExp>} */ ({
  ".githooks/pre-commit": new RegExp(`^${X} secrets --staged$`),
  ".githooks/pre-push":
    /^(npm|pnpm|yarn|bun)( -s| --silent)?( run)?( -s| --silent)? gate( --)?( --refs)?$/,
  ".githooks/commit-msg": new RegExp(
    `^${X} scrub --message "\\$1"( && ${X} changelog --message "\\$1")?$`,
  ),
});

/**
 * Whether a hook is one an earlier version wrote and nobody edited since: its commands, comments
 * and blank lines aside, are exactly ones `init` has written. Such a hook is refreshed; any other
 * is the repository's own, and gets the new version beside it instead.
 * @param {string} rel @param {string} text
 */
export function writtenByInit(rel, text) {
  const re = EARLIER[rel];
  const commands = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return commands.length > 0 && commands.every((c) => Boolean(re?.test(c)));
}

/**
 * The hooks git records as not executable, from the index rather than the disk: a hook committed
 * from Windows arrives 100644 on every other machine, where git skips it silently, and the file
 * on this disk says nothing about that.
 * @param {string} repoDir
 * @returns {string[]}
 */
export function hooksNotExecutable(repoDir) {
  return git(repoDir, "ls-files", "-s", "--", ".githooks")
    .split("\n")
    .filter(Boolean)
    .filter((l) => !l.startsWith("100755 "))
    .map((l) => l.split("\t")[1] || "")
    .filter(Boolean);
}
