import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { templatePlaceholders } from "../src/rules/families/documents.mjs";

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

test("the git hooks init writes are executable where they are installed, and nothing is staged for another session to sweep in", () => {
  // git skips a hook that is not executable and says so only as a hint, so a pre-push hook
  // written 644 means the gate never runs on a push and a red tree reads as a green one. This
  // repository pushed past its own red gate for days that way. init once staged the hooks to
  // carry the bit, and in a repository several sessions share the next commit of any of them
  // swept the staged files in: `abatty hooks`, which hooks:install runs, sets the bit instead.
  const dir = tempRepo("init-hook-mode", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.equal(r.code, 0, r.out);
  assert.equal(git(dir, "diff", "--cached", "--name-only"), "", "init stages nothing");
  const installed = cli(["hooks", dir], dir);
  assert.equal(installed.code, 0, installed.out);
  assert.equal(git(dir, "config", "core.hooksPath"), ".githooks");
  git(dir, "add", "--chmod=+x", "--", ".githooks");
  assert.match(
    readFileSync(join(dir, ".githooks/commit-msg"), "utf8"),
    /abatty scrub --message "\$1" && npx abatty changelog --message "\$1"/,
    "the commit-msg hook holds the scrub and the changelog rule, one command each",
  );
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

test("a preset's library rule files are written only where the repository depends on the library", () => {
  // The catalog's rules carry an `applies` predicate; the preset's rule files carried none, so
  // every repository on this preset received the GraphQL, Sequelize and Material UI rules whether
  // or not it had any of them. One client's stack was arriving in every stranger's repository.
  const base = { name: "app", private: true, version: "0.1.0" };
  const react = { react: "19.0.0", "react-dom": "19.0.0" };

  const plain = tempRepo("init-rules-plain", {
    "package.json": JSON.stringify({
      ...base,
      dependencies: react,
      devDependencies: { vite: "6" },
    }),
    "src/main.jsx": "export default 1;\n",
  });
  const r = cli(["init", plain, "--stack", "vite-react"], plain);
  assert.equal(r.code, 0, r.out);
  for (const f of ["testing.md", "i18n.md", "a11y.md", "size-limits.md"])
    assert.ok(existsSync(join(plain, ".claude/rules", f)), `the practice file ${f} is written`);
  for (const f of ["graphql.md", "sequelize.md", "mui.md"])
    assert.equal(
      existsSync(join(plain, ".claude/rules", f)),
      false,
      `${f} is not written to a repository without the library`,
    );
  assert.match(r.out, /n\/a\s+\.claude\/rules\/sequelize\.md/, "and the skip is reported");

  // The same preset where the libraries ARE present: every file is written, so the gate is not
  // simply switched off.
  const full = tempRepo("init-rules-full", {
    "package.json": JSON.stringify({
      ...base,
      dependencies: { ...react, graphql: "16", sequelize: "6", "@mui/material": "6" },
      devDependencies: { vite: "6" },
    }),
    "src/main.jsx": "export default 1;\n",
  });
  assert.equal(cli(["init", full, "--stack", "vite-react"], full).code, 0);
  for (const f of ["graphql.md", "sequelize.md", "mui.md"])
    assert.ok(existsSync(join(full, ".claude/rules", f)), `${f} is written where the library is`);

  // And the harness agrees with itself: a file that does not apply is not managed, so `update`
  // does not add it back and `doctor` does not call it missing.
  const doctor = cli(["doctor", plain, "--skip-self-test"], plain);
  assert.doesNotMatch(
    doctor.out,
    /missing\s+\.claude\/rules\/(graphql|sequelize|mui)\.md/,
    doctor.out,
  );
  const again = cli(["update", plain], plain);
  assert.doesNotMatch(again.out, /added\s+\.claude\/rules\/(graphql|sequelize|mui)\.md/, again.out);
});

test("the context file is not the template: init fills the name, and DOC-CONTEXT names every placeholder still standing", () => {
  // A trial repository ran two days on an AGENTS.md that was the unfilled template, `<project
  // name>` and all, and every check said present because the sections were all there.
  const dir = tempRepo("init-placeholders", { "package.json": NEXT_PKG });
  assert.equal(cli(["init", dir, "--stack", "next"], dir).code, 0);
  const written = readFileSync(join(dir, "AGENTS.md"), "utf8");
  assert.match(written, /^# [A-Z]+\.md - fixture-next$/m, "the name a machine can fill is filled");
  assert.ok(!written.includes("<project name>"));
  const left = templatePlaceholders(written);
  assert.ok(left.length >= 10, `the questions are still there: ${left.length}`);
  assert.ok(left.some((l) => /^<e\.g\. /.test(l)));
  // A convention written with angle brackets is not a placeholder.
  assert.deepEqual(
    templatePlaceholders(
      "`.claude/rules/<topic>.md`, `<type>/<short-description>`, <!-- a comment --> and <br />",
    ),
    [],
  );

  const before = runCatalog(buildContext(dir), RULES).find((f) => f.id === "DOC-CONTEXT");
  assert.equal(before?.status, "partial");
  assert.match(before?.evidence || "", /\d+ template placeholder\(s\) left: <Two sentences/);
  assert.match(before?.next || "", /Fill the placeholders/);

  // Filled in, the same file is present: the control in the other direction.
  writeFileSync(
    join(dir, "AGENTS.md"),
    written.replace(/<(?![!/])[^<>\n]*\s[^<>\n]*>/g, "answered"),
  );
  const after = runCatalog(buildContext(dir), RULES).find((f) => f.id === "DOC-CONTEXT");
  assert.equal(after?.status, "present", after?.evidence);
});

test("a monorepo gets a graph over the folders its sources are in, and keeps its own context file as the one source", () => {
  const dir = tempRepo("init-monorepo", {
    "package.json": JSON.stringify({
      name: "mono",
      workspaces: ["apps/*", "packages/*"],
      dependencies: { next: "15.0.0" },
    }),
    "apps/web/package.json": JSON.stringify({ name: "web", dependencies: { next: "15.0.0" } }),
    "packages/db/package.json": JSON.stringify({ name: "db" }),
    "CLAUDE.md": "# mono\n\nOur own context, written before abatty came.\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const scripts = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts;
  assert.match(scripts.graph, /^depcruise apps packages /, "no src here: the workspace folders");
  assert.equal(
    readFileSync(join(dir, "CLAUDE.md"), "utf8"),
    "# mono\n\nOur own context, written before abatty came.\n",
  );
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  assert.match(agents, /context is `CLAUDE\.md`/, "a pointer, not an unfilled template");
  assert.doesNotMatch(agents, /<[a-z ]+>/, "no placeholder left to read as the real context");
});

test("the database suite is selected by a migration in a workspace, not only at the root", async () => {
  const { presetById } = await import("../src/presets/index.mjs");
  const db = presetById("next")?.gate.suites[0]?.paths;
  assert.ok(db);
  assert.ok(db.test("packages/db/migrations/0001_init.sql"));
  assert.ok(db.test("migrations/0001_init.sql"));
  assert.ok(!db.test("docs/migrations-guide.md"), "a folder merely named like one is not");
});
