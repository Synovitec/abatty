import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

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
  assert.match(r.out, /--stack <next\|astro\|vite-react\|node>/);
});

test("init --dry-run writes nothing", () => {
  const dir = tempRepo("init4", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next", "--dry-run"], dir);
  assert.equal(r.code, 0, r.out);
  assert.equal(existsSync(join(dir, ".claude")), false);
});
