import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// A corpus of spellings, not a set of examples. Five families of hole in the guard were found by
// replaying spellings against a published artifact rather than by reading the code, which read
// correct every time. The rows below are the accumulated result of that, contributed by the
// reviewing session that found two of the five families and by the fixes for the other three.
// They live here so they run on every push instead of in one conversation.
//
// Every row is judged STANDING ON THE BASE BRANCH. Several only mean anything under that
// condition: a bare `git push`, and every HEAD or @ row. The same rows are replayed from a
// feature branch below, where they must all flip to allowed, which is the false-positive half
// of the same question.

const GUARD = resolve("templates/harness/hooks/guard.mjs");

/** A repository standing on a named branch, with a commit, because a branch no commit has
 *  reached cannot be named by rev-parse and every HEAD row would pass for the wrong reason. */
/** @param {string} branch @returns {string} */
function repoOn(branch) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-corpus-"));
  const git = (/** @type {string[]} */ ...a) => spawnSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git("config", "user.email", "corpus@example.com");
  git("config", "user.name", "Corpus");
  git("commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "init");
  writeFileSync(
    join(dir, "abatty.config.json"),
    JSON.stringify({ baseBranch: "main", directPushToBase: false }),
  );
  return dir;
}

const decide = (/** @type {string} */ dir, /** @type {string} */ command) => {
  const r = spawnSync(process.execPath, [GUARD], {
    cwd: dir,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, ADOPTION_RUN: "", ADOPTION_BRANCH: "", ADOPTION_BASE: "" },
  });
  assert.equal(r.status, 0, `the guard must not crash on: ${command}`);
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "none";
  } catch {
    return "none";
  }
};

/** The bypass flag, assembled so this file does not contain the literal it is about. */
const NV = ["--no", "verify"].join("-");

/** @type {[string, string][]} Rows that must be refused while standing on the base branch. */
const DENY = [
  // the hook bypass, every spelling git accepts
  ['git commit -nm "x"', "cluster"],
  ['git commit -anm "x"', "cluster, with more in it"],
  ['git commit -n -m "x"', "on its own"],
  [`git commit -m "x" ${NV}`, "the long flag, trailing"],
  ['git commit "-nm" "x"', "the cluster, quoted"],
  [`git commit "${NV}" -m "x"`, "the long flag, quoted"],
  ["git commit '-n' -m x", "single quotes"],
  // force push
  ["git push --force origin dev", "the long flag"],
  ["git push --force-with-lease origin dev", "the lease"],
  ["git push -f origin dev", "the short flag"],
  ["git push -fu origin dev", "bundled"],
  ["git push -uf origin dev", "bundled, other order"],
  ['git push "--force" origin dev', "quoted"],
  ["git push '-f' origin dev", "quoted, single"],
  ['git push "-fu" origin dev', "quoted cluster"],
  ['git push origin "+main"', "a refspec forced with a plus"],
  // the base branch, by every door
  ["git push origin main", "by name"],
  ["git push origin HEAD", "HEAD resolves to the branch you are on"],
  ["git push -u origin HEAD", "with an upstream flag"],
  ["git push -u origin @", "the alias"],
  ["git push origin HEAD:main", "a refspec"],
  ["git push", "no refspec: the upstream of the branch you are on"],
  ["git push origin main 2>&1 | tee out.log", "a redirection is not the target"],
  ["git push origin main >log 2>&1", "nor is a file"],
  ['git push origin "main"', "quoted"],
  ["git push origin 'main'", "quoted, single"],
  ['git push origin "HEAD:main"', "a quoted refspec"],
  ['git push origin "HEAD"', "a quoted HEAD"],
  // wrappers: none of these is a program the guard knows, so all take the conservative path
  ['sh -c "git push origin main"', "a shell"],
  ['sh -c "git push --force origin dev"', "a shell, force"],
  ['bash -c "git push --force origin dev"', "another shell"],
  ['eval "git push --force origin dev"', "eval"],
  ["echo dev | xargs git push --force origin", "xargs"],
  ["env GIT_TRACE=1 git push --force origin dev", "an environment prefix"],
  ["timeout 5 git push --force origin dev", "a wrapper no list remembers"],
  ["sudo git push --force origin dev", "another"],
  ["$(echo git) push --force origin dev", "a substitution in command position"],
  // the forge's API is another door to the same branch
  ["gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc", "moving the ref"],
  ["gh api -X POST repos/o/r/merges -f base=main", "merging into it"],
];

/** @type {[string, string][]} Rows that must be allowed, on any branch. */
const ALLOW = [
  ['git commit -am "x"', "a cluster without the bypass in it"],
  ['git commit -m "x"', "an ordinary commit"],
  ["git push -u origin dev", "an upstream flag is not a force"],
  ["git push origin dev", "another branch"],
  ["git push origin some-feature", "and another"],
  ['git push origin "some-feature"', "quoted"],
  ["git push -u origin feature/main-nav", "a branch whose name carries the base's"],
  ["gh api repos/o/r/git/refs/heads/main", "reading a ref is not writing it"],
  // The three the tokenizer exists for: honest read-only commands that name the spellings.
  ['rg "git push --force" docs/', "a search whose pattern is a command"],
  [`grep -nE "git push|${NV}" .claude/hooks/guard.mjs`, "reading the guard's own source"],
  [`echo "the bypass flag is ${NV}"`, "saying the name of a thing"],
];

test("the corpus: every spelling that must be refused from the base branch", () => {
  const dir = repoOn("main");
  const wrong = DENY.filter(([cmd]) => decide(dir, cmd) !== "deny").map(([cmd]) => cmd);
  assert.deepEqual(wrong, [], `allowed but must be refused:\n${wrong.join("\n")}`);
});

test("the corpus: every command that must stay allowed", () => {
  const dir = repoOn("main");
  const wrong = ALLOW.filter(([cmd]) => decide(dir, cmd) !== "none").map(([cmd]) => cmd);
  assert.deepEqual(wrong, [], `refused but must be allowed:\n${wrong.join("\n")}`);
});

// The other half of the HEAD family: off the base branch, pushing HEAD is pushing the branch you
// are on, which is not the base. A guard that refuses it there is refusing ordinary work.
test("the corpus: from a feature branch, the branch-relative rows flip to allowed", () => {
  const dir = repoOn("feature/x");
  const relative = [
    "git push origin HEAD",
    "git push -u origin @",
    "git push",
    'git push origin "HEAD"',
  ];
  const wrong = relative.filter((cmd) => decide(dir, cmd) !== "none");
  assert.deepEqual(wrong, [], `refused off the base branch:\n${wrong.join("\n")}`);
  // The rows that are about the base by name, or about a flag, do not flip.
  for (const cmd of ["git push origin main", "git push --force origin dev", 'git commit -nm "x"'])
    assert.equal(decide(dir, cmd), "deny", cmd);
});
