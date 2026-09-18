import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";

test("init --stack next writes the harness, the tooling, the scripts and the day-0 documents", () => {
  const dir = tempRepo("init", {
    "package.json": NEXT_PKG,
    "src/app/page.tsx": "export default function Page() { return null; }\n",
  });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(r.code, 0, r.out);
  for (const f of [
    ".claude/settings.json",
    "abatty.config.json",
    ".claude/mcp.night.json",
    ".claude/hooks/self-test.mjs",
    ".claude/hooks/protect.mjs",
    ".claude/hooks/guard.mjs",
    ".claude/hooks/stop-gate.mjs",
    ".claude/hooks/check-direction.mjs",
    ".claude/skills/adopt-standards/SKILL.md",
    ".claude/agents/standards-reviewer.md",
    ".claude/rules/testing.md",
    ".dependency-cruiser.cjs",
    "knip.jsonc",
    ".githooks/pre-push",
    "CLAUDE.md",
    "CHANGELOG.md",
    "docs/README.md",
    "docs/STANDARDS_PROGRESS.md",
    "docs/ADOPTION_DECISIONS.md",
  ]) {
    assert.ok(existsSync(join(dir, f)), `missing ${f}`);
  }
  const adoption = JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8"));
  assert.equal(adoption.stack, "next");
  assert.equal(adoption.commands.gate, "npm run gate:fast");
  assert.deepEqual(adoption.mcpServers, []);
  assert.ok(adoption.phases.includes(12));
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.scripts.gate, "abatty gate");
  assert.equal(pkg.scripts.graph.includes("--ignore-known"), true);
  assert.equal(pkg.scripts.test, "node -e process.exit(0)", "an existing script is kept");
  assert.match(readFileSync(join(dir, ".gitignore"), "utf8"), /\.claude\/night\//);
  assert.match(r.out, /npm i -D dependency-cruiser knip/);
  assert.match(r.out, /proven by paycore_dms/);
});

test("init is idempotent: a second run keeps every file, --force overwrites", () => {
  const dir = tempRepo("init2", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  writeFileSync(join(dir, ".claude/hooks/guard.mjs"), "// edited locally\n");
  const again = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(again.code, 0, again.out);
  assert.equal(readFileSync(join(dir, ".claude/hooks/guard.mjs"), "utf8"), "// edited locally\n");
  assert.match(again.out, /kept\s+\.claude\/hooks\/guard\.mjs/);
  const forced = cli(["init", dir, "--stack", "next", "--force"], dir);
  assert.equal(forced.code, 0, forced.out);
  assert.match(readFileSync(join(dir, ".claude/hooks/guard.mjs"), "utf8"), /PreToolUse/);
});

test("init without a detectable stack refuses and names the presets", () => {
  const dir = tempRepo("init3", {
    "package.json": JSON.stringify({ name: "x", dependencies: {} }),
  });
  const r = cli(["init", dir], dir);
  assert.equal(r.code, 2);
  assert.match(r.out, /--stack <next\|astro\|vite-react\|node\|python\|docs>/);
});

test("init --dry-run writes nothing", () => {
  const dir = tempRepo("init4", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next", "--dry-run"], dir);
  assert.equal(r.code, 0, r.out);
  assert.equal(existsSync(join(dir, ".claude")), false);
});

test("init merges the config at every depth: a repository that set one key of a block keeps the rest", () => {
  const dir = tempRepo("init5", {
    "package.json": NEXT_PKG,
    // A repository that named its own baseline and nothing else of `files`. Shallow was the bug:
    // the five keys the template names went missing and the harness self-test then failed on the
    // state file it could no longer find.
    "abatty.config.json": JSON.stringify({
      files: { baseline: "ci/floor.json" },
      commands: { gate: "make gate" },
      scrub: { enabled: true },
    }),
  });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(r.code, 0, r.out);
  const cfg = JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8"));
  assert.equal(cfg.files.baseline, "ci/floor.json", "the value the repository set wins");
  assert.equal(cfg.files.state, "docs/ADOPTION_STATE.json", "the keys it never set are added");
  assert.equal(cfg.files.changelog, "CHANGELOG.md");
  assert.equal(cfg.files.decisions, "docs/ADOPTION_DECISIONS.md");
  assert.equal(cfg.files.progress, "docs/STANDARDS_PROGRESS.md");
  assert.equal(cfg.commands.gate, "make gate", "the same one block deeper");
  assert.equal(typeof cfg.commands.typecheck, "string");
  assert.equal(cfg.scrub.enabled, true);
  // And it settles: a second run over the merged file changes nothing.
  const again = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /kept\s+abatty\.config\.json/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8")), cfg);
});

test("the git hooks init writes are executable, in the filesystem and in the index", () => {
  // git skips a hook that is not executable and says so only as a hint, so a pre-push hook
  // written 644 means the gate never runs on a push and a red tree reads as a green one. This
  // repository pushed past its own red gate for days that way.
  const dir = tempRepo("init-hook-mode", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(r.code, 0, r.out);
  git(dir, "add", "-A");
  for (const hook of ["pre-commit", "pre-push", "commit-msg"]) {
    const rel = `.githooks/${hook}`;
    assert.ok(existsSync(join(dir, rel)), `init writes ${rel}`);
    if (process.platform !== "win32")
      assert.ok(statSync(join(dir, rel)).mode & 0o111, `${rel} is executable on disk`);
    const entry = git(dir, "ls-files", "-s", "--", rel);
    assert.match(entry, /^100755 /, `${rel} is executable in the index: ${entry}`);
  }
  // A repository that already has one keeps its content, and the mode is repaired anyway.
  writeFileSync(join(dir, ".githooks/pre-push"), "#!/bin/sh\nnpm run -s gate\n# ours\n");
  spawnSync("git", ["update-index", "--chmod=-x", "--", ".githooks/pre-push"], { cwd: dir });
  cli(["init", dir, "--stack", "next"], dir);
  assert.match(readFileSync(join(dir, ".githooks/pre-push"), "utf8"), /# ours/, "content kept");
  assert.match(git(dir, "ls-files", "-s", "--", ".githooks/pre-push"), /^100755 /, "mode repaired");
});
