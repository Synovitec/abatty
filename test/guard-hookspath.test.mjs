import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The hook bypass by its effect: git runs the hooks from core.hooksPath, so pointing it elsewhere
// or unsetting it skips them exactly as the flag does. An adopter replayed five such spellings
// against 0.5.2 and every one passed, from the base branch too; at night, deleting the pre-push
// hook passed as well. Assembled so this file carries neither literal it is about.

const GUARD = resolve("templates/harness/hooks/guard.mjs");
const NV = ["--no", "verify"].join("-");
const HP = ["core", "hooksPath"].join(".");

/** @param {string} branch */
function repoOn(branch) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-hookspath-"));
  const git = (/** @type {string[]} */ ...a) => spawnSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git(
    "-c",
    "user.email=h@example.com",
    "-c",
    "user.name=H",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  writeFileSync(join(dir, "abatty.config.json"), JSON.stringify({ baseBranch: "main" }));
  return dir;
}

/** @param {string} dir @param {string} command @param {Record<string, string>} [env] */
function decide(dir, command, env = {}) {
  const r = spawnSync(process.execPath, [GUARD], {
    cwd: dir,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, ADOPTION_RUN: "", ADOPTION_BRANCH: "", ADOPTION_BASE: "", ...env },
  });
  assert.equal(r.status, 0, `the guard must not crash on: ${command}`);
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? "none";
  } catch {
    return "none";
  }
}

const OFF = [
  `git -c ${HP}=/dev/null commit -m x`,
  `git -c ${HP}=/dev/null push origin dev`,
  `git config ${HP} /dev/null`,
  `git config --local ${HP} .git/hooks-off`,
  `git config --unset ${HP}`,
  `sh -c "git config ${HP} /tmp/none"`,
  `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=${HP} GIT_CONFIG_VALUE_0=/dev/null git commit -m x`,
  `export GIT_CONFIG_KEY_0=${HP}`,
  `sh -c "git -c ${HP}=/dev/null commit -m x"`,
];
const KEPT = [
  `git config --get ${HP}`,
  `git config ${HP}`,
  // Pointing the key AT the hooks installs them: what `abatty hooks` and husky run, and what the
  // shipped settings pre-approve. The first rule refused these, and so its own install command.
  `git config ${HP} .githooks`,
  `git config --local ${HP} .husky/_`,
  `git -c ${HP}=.githooks commit -m x`,
  // Opaque segments the first rule over-read: a read inside a substitution, and bash's own -c.
  `CURRENT=$(git config ${HP})`,
  `bash -c "grep ${HP} README.md"`,
  `rg "GIT_CONFIG_KEY_0=${HP}" docs/`,
  `grep -n ${HP} README.md`,
  // An opaque segment that names the key without a way to set it: the guard refused its own
  // author's `sed` over this very file until the rule asked for a config verb too.
  `sed -i s/a/b/ docs/${HP}.md`,
  // The flag named inside a message is text, not argv of its own: the audit found no case
  // locking it, while `git commit "${NV}"` (a token of its own) stays refused by the corpus.
  `git commit -m "docs: explain why ${NV} is refused"`,
  `git commit -F - <<'EOF'\ndocs: explain why ${NV} is refused\nEOF`,
];

for (const branch of ["main", "feature/x"])
  test(`on ${branch}: every way of switching the hooks off by configuration is refused, reading is not`, () => {
    const dir = repoOn(branch);
    assert.deepEqual(
      OFF.filter((c) => decide(dir, c) !== "deny"),
      [],
      "allowed but must be refused",
    );
    assert.deepEqual(
      KEPT.filter((c) => decide(dir, c) !== "none"),
      [],
      "refused but must be allowed",
    );
  });

test("at night the git hooks folders are harness: deleting or editing a hook is refused", () => {
  const dir = repoOn("adopt/standards-x");
  const night = { ADOPTION_RUN: "1", ADOPTION_BRANCH: "adopt/standards-x" };
  assert.equal(decide(dir, "rm .githooks/pre-push", night), "deny");
  assert.equal(decide(dir, "sed -i s/x/y/ .husky/pre-commit", night), "deny");
  assert.equal(decide(dir, "cat .githooks/pre-push", night), "none");
  assert.equal(decide(dir, "rm .githooks/pre-push"), "none", "by day the file tools decide");
});
