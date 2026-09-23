import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import { changelogPairs, coupledFindings, stagedVerdict } from "../src/core/coupled.mjs";
import { foldRelease, readFragments } from "../src/core/fragments.mjs";

// The rule is that a change says what it changed in the same push. Written as a line under
// [Unreleased], every pair of parallel branches edits one hunk: an adopter merging eight pull
// requests in a day resolved four conflicts, all in the changelog, none in code. A fragment is a
// file of its own, so parallel branches never meet, and the release folds them in.

const CHANGELOG = `# Changelog

## [Unreleased]

### Fixed

- **An old line.** Written the old way.

## [0.1.0] - 2026-01-01

- The first release.
`;

test("a release folds [Unreleased] and every fragment into a dated section, by section, and removes the fragments", () => {
  const dir = tempRepo("fragments-fold", {
    "CHANGELOG.md": CHANGELOG,
    "changes/unreleased/guard-worktree.fixed.md": "- **The guard follows cd.** It did not.\n",
    "changes/unreleased/probe.added.md": "- **A probe.** It counts.\n",
    "changes/unreleased/wording.md": "- **Wording.** A section it did not name.\n",
    "changes/unreleased/README.md": "How to write a fragment.\n",
  });
  assert.deepEqual(
    readFragments(dir, "changes/unreleased").map((f) => f.section),
    ["Fixed", "Added", "Changed"],
  );
  const r = foldRelease({
    repoDir: dir,
    changelog: "CHANGELOG.md",
    folder: "changes/unreleased",
    version: "0.2.0",
    date: "2026-09-24",
  });
  assert.equal(r.fragments, 3);
  const text = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
  assert.equal(
    text,
    `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-24

### Added

- **A probe.** It counts.

### Changed

- **Wording.** A section it did not name.

### Fixed

- **An old line.** Written the old way.
- **The guard follows cd.** It did not.

## [0.1.0] - 2026-01-01

- The first release.
`,
  );
  assert.equal(existsSync(join(dir, "changes/unreleased/probe.added.md")), false);
  assert.equal(existsSync(join(dir, "changes/unreleased/README.md")), true, "not a fragment");
});

test("a fragment is the changelog entry, at commit time and over the pushed range, only where the repository keeps them", () => {
  const on = changelogPairs({
    changelog: "CHANGELOG.md",
    changelogRequiredFor: ["src/"],
    changelogFragments: "changes/unreleased/",
  });
  const off = changelogPairs({ changelog: "CHANGELOG.md", changelogRequiredFor: ["src/"] });
  const staged = ["src/a.mjs", "changes/unreleased/a.fixed.md"];
  assert.equal(stagedVerdict(staged, on).ok, true);
  assert.equal(stagedVerdict(staged, off).ok, false, "without the setting a fragment is not one");
  const commits = [{ sha: "a", subject: "fix: a", files: staged }];
  assert.deepEqual(coupledFindings(commits, on), []);
  assert.equal(coupledFindings(commits, off).length, 1);
});

test("abatty changelog --release cuts the release from the command line", () => {
  const dir = tempRepo("fragments-cli", {
    "CHANGELOG.md": CHANGELOG,
    "abatty.config.json": JSON.stringify({ files: { changelogFragments: "changes/unreleased" } }),
    "changes/unreleased/x.fixed.md": "- **X.** Fixed.\n",
  });
  const r = cli(["changelog", dir, "--release", "0.2.0", "--date", "2026-09-24"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /released as \[0\.2\.0\], 1 fragment\(s\) folded in/);
  assert.match(readFileSync(join(dir, "CHANGELOG.md"), "utf8"), /## \[0\.2\.0\] - 2026-09-24/);
});

test("the Stop hook takes a fragment as the changelog entry", () => {
  const dir = tempRepo("fragments-stop", { "package.json": NEXT_PKG, "src/a.ts": "export {};\n" });
  cli(["init", dir, "--stack", "next"], dir);
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts["gate:fast"] = 'node -e "process.exit(0)"';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.commands.gate = "npm run gate:fast";
  cfg.files.changelogFragments = "changes/unreleased";
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  git(dir, "checkout", "-q", "-b", "adopt/standards-test");
  writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a");
  const stop = () =>
    spawnSync(process.execPath, [join(dir, ".claude/hooks/stop-gate.mjs")], {
      cwd: dir,
      input: JSON.stringify({ session_id: "fragments-test", hook_event_name: "Stop" }),
      encoding: "utf8",
      env: {
        ...process.env,
        ADOPTION_CONFIG: "",
        ADOPTION_RUN: "1",
        ADOPTION_BASE: "main",
        ADOPTION_BRANCH: "adopt/standards-test",
        ABATTY_AGENT: STUB_AGENT,
      },
    });
  const blocked = stop();
  assert.equal(blocked.status, 2, blocked.stdout + blocked.stderr);
  assert.match(blocked.stderr, /touched source after the last/);
  mkdirSync(join(dir, "changes/unreleased"), { recursive: true });
  writeFileSync(join(dir, "changes/unreleased/a.added.md"), "- **A.** Added.\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: the entry for a");
  const allowed = stop();
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
});
