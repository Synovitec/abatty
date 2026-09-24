/**
 * Pipelines that judge a new branch by its last commit. A push that opens a branch carries no
 * `before` (the forge sends forty zeros), and a hand-written fallback to `HEAD~1` then judges one
 * commit of however many the branch holds: an adopter's CI judged one of four and printed green.
 * The fork from the base holds the branch; `--range auto` finds it.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where the providers keep their pipelines. */
const PIPELINE_DIRS = [
  ".github/workflows",
  ".woodpecker",
  ".gitea/workflows",
  ".forgejo/workflows",
];
const PIPELINE_FILES = [".gitlab-ci.yml", ".woodpecker.yml", "bitbucket-pipelines.yml"];

/** A range that starts one commit back, the way a fallback spells it. */
const LAST_COMMIT = /\bHEAD(~1?|\^)(\.\.|\s|["'`]|$)/;

/**
 * The lines of the repository's pipelines that fall back to the last commit, in a file that also
 * reads the push's `before`: the file that meant to judge the push and, on a new branch, does not.
 * A `HEAD~1` in a file that never reads `before` is some other use and is left alone.
 * @param {string} repoDir @returns {{ file: string, line: number, text: string }[]}
 */
export function narrowFallbacks(repoDir) {
  const files = [
    ...PIPELINE_DIRS.flatMap((d) =>
      existsSync(join(repoDir, d))
        ? readdirSync(join(repoDir, d))
            .filter((f) => /\.ya?ml$/.test(f))
            .map((f) => `${d}/${f}`)
        : [],
    ),
    ...PIPELINE_FILES.filter((f) => existsSync(join(repoDir, f))),
  ];
  /** @type {{ file: string, line: number, text: string }[]} */
  const found = [];
  for (const file of files) {
    const text = readFileSync(join(repoDir, file), "utf8");
    if (!/\bbefore\b|CI_COMMIT_BEFORE_SHA|CI_PREV_COMMIT_SHA/i.test(text)) continue;
    text.split("\n").forEach((l, i) => {
      if (!/^\s*#/.test(l) && LAST_COMMIT.test(l))
        found.push({ file, line: i + 1, text: l.trim() });
    });
  }
  return found;
}
