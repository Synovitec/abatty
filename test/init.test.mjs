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
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  writeFileSync(join(dir, ".claude/hooks/guard.mjs"), "// edited locally\n");
  const again = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.equal(again.code, 0, again.out);
  assert.equal(readFileSync(join(dir, ".claude/hooks/guard.mjs"), "utf8"), "// edited locally\n");
  assert.match(again.out, /kept\s+\.claude\/hooks\/guard\.mjs/);
  const forced = cli(["init", "--profile", "synovitec", dir, "--stack", "next", "--force"], dir);
  assert.equal(forced.code, 0, forced.out);
  assert.match(readFileSync(join(dir, ".claude/hooks/guard.mjs"), "utf8"), /PreToolUse/);
});

test("a package no framework claims is a Node package; with no package at all, the docs preset", () => {
  // An outside review's plain Node package was refused with "no preset" until --stack node.
  const plain = tempRepo("init3", {
    "package.json": JSON.stringify({ name: "x", dependencies: {} }),
  });
  const r = cli(["init", "--profile", "synovitec", plain, "--dry-run"], plain);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /init · Node service/);
  // A design repository (docs, a mockup's scripts, a schema, no package) was refused with "no
  // preset" and a package.json named that did not exist; it is the docs preset's shape.
  const design = tempRepo("init3-design", {
    "docs/a.md": "# a\n",
    "mockups/js/000-app.js": "window.app = 1;\n",
    "migrate/src/a.ts": "export const a = 1;\n",
  });
  const r2 = cli(["init", design, "--dry-run"], design);
  assert.equal(r2.code, 0, r2.out);
  assert.match(r2.out, /init · Documents/);
  assert.doesNotMatch(r2.out, /package\.json\)/);
  // and a language no preset covers is still refused by name, never taken for documents
  const go = tempRepo("init3-go", { "go.mod": "module x\n", "main.go": "package main\n" });
  assert.equal(cli(["init", go, "--yes"], go).code, 2);
});

test("init --dry-run writes nothing", () => {
  const dir = tempRepo("init4", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next", "--dry-run"], dir);
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
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  const again = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
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
  const r = cli(["init", "--profile", "synovitec", plain, "--stack", "vite-react"], plain);
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
  assert.equal(
    cli(["init", "--profile", "synovitec", full, "--stack", "vite-react"], full).code,
    0,
  );
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
  assert.equal(cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir).code, 0);
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
  assert.match(before?.evidence || "", /\d+ template placeholder\(s\) left: <One sentence/);
  assert.match(before?.next || "", /Fill the placeholders/);

  // Filled in, the same file is present: the control in the other direction.
  writeFileSync(
    join(dir, "AGENTS.md"),
    written.replace(/<(?![!/])([^<>\n]*\s[^<>\n]*|(?:[A-Z]|e\.g\.)[^<>]*\n[^<>]*)>/g, "answered"),
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
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const scripts = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts;
  assert.match(scripts.graph, /^depcruise apps packages /, "no src here: the workspace folders");
  assert.equal(
    readFileSync(join(dir, "CLAUDE.md"), "utf8"),
    "# mono\n\nOur own context, written before abatty came.\n",
  );
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  assert.match(agents, /context is `CLAUDE.md`/, "a pointer, not an unfilled template");
  assert.doesNotMatch(agents, /<[a-z ]+>/, "no placeholder left to read as the real context");
  // --force rewrites the harness, never the repository's own context
  cli(["init", "--profile", "synovitec", dir, "--stack", "next", "--force"], dir);
  assert.equal(
    readFileSync(join(dir, "CLAUDE.md"), "utf8"),
    "# mono\n\nOur own context, written before abatty came.\n",
    "the context survives --force",
  );
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), agents);
});

test("init --force on its own install keeps the template as the context and the import beside it", () => {
  const dir = tempRepo("init-force-own", { "package.json": JSON.stringify({ name: "p" }) });
  cli(["init", "--profile", "synovitec", dir, "--stack", "node"], dir);
  cli(["init", "--profile", "synovitec", dir, "--stack", "node", "--force"], dir);
  assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.doesNotMatch(readFileSync(join(dir, "AGENTS.md"), "utf8"), /context is `CLAUDE.md`/);
});

test("the database suite is selected by a migration in a workspace, not only at the root", async () => {
  const { presetById } = await import("../src/presets/index.mjs");
  const db = presetById("next")?.gate.suites[0]?.paths;
  assert.ok(db);
  assert.ok(db.test("packages/db/migrations/0001_init.sql"));
  assert.ok(db.test("migrations/0001_init.sql"));
  assert.ok(!db.test("docs/migrations-guide.md"), "a folder merely named like one is not");
});

test("the executable bit a filesystem would not keep is said once, as one command, and never for a .cmd", () => {
  const dir = tempRepo("init-chmod", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.equal(r.code, 0, r.out);
  const lines = r.out.split("\n").filter((l) => l.includes("--chmod=+x"));
  if (process.platform === "win32") {
    assert.equal(lines.length, 1, r.out);
    assert.match(String(lines[0]), /^\s+\d+\. git add --chmod=\+x .*\.githooks\/pre-push/);
    assert.doesNotMatch(String(lines[0]), /\.cmd\b/);
  } else assert.equal(lines.length, 0, "the bit is kept here, so nothing to say");
});

test("the PWA rule file is written where the catalog reads a PWA, and skipped, said, where it does not", () => {
  const plain = tempRepo("init-nopwa", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", plain, "--stack", "next"], plain);
  assert.equal(existsSync(join(plain, ".claude/rules/pwa.md")), false, r.out);
  assert.match(
    r.out,
    /\.claude\/rules\/pwa\.md · no service worker or web manifest in this repository/,
  );
  const pwa = tempRepo("init-pwa", {
    "package.json": NEXT_PKG,
    "public/manifest.webmanifest": '{ "name": "app" }\n',
  });
  cli(["init", "--profile", "synovitec", pwa, "--stack", "next"], pwa);
  assert.equal(existsSync(join(pwa, ".claude/rules/pwa.md")), true);
});

test("a gate step that will be skipped for want of its config is named, apart from the steps to take", () => {
  const bare = tempRepo("init-noprettier", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", bare, "--stack", "next"], bare);
  assert.match(r.out, /Not in the gate yet[\s\S]*the gate skips format until a \.prettierrc/);
  assert.doesNotMatch(r.out, /\d+\. the gate skips format/, "a note, not a numbered step");
  const held = tempRepo("init-prettier", { "package.json": NEXT_PKG, ".prettierrc": "{}\n" });
  assert.doesNotMatch(
    cli(["init", "--profile", "synovitec", held, "--stack", "next"], held).out,
    /the gate skips format/,
  );
});

test("a merged file says what init put in it, and a key the repository set is not named", () => {
  const dir = tempRepo("init-merged", {
    "package.json": JSON.stringify({ ...JSON.parse(NEXT_PKG), scripts: { lint: "next lint" } }),
    ".gitignore": "node_modules\n",
  });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const pkg = r.out.split("\n").find((l) => /merged\s+package\.json/.test(l)) || "";
  assert.match(pkg, /scripts added: .*\bgate\b/, r.out);
  assert.doesNotMatch(pkg, /\blint\b/, "the repository's own script is kept, so not added");
  assert.match(r.out, /merged\s+\.gitignore · added \.claude\/night\/, \.abatty\//);
});

test("the git shim is said for what it is: the night's, refusing three bypasses, never your shell's", () => {
  const dir = tempRepo("init-shim", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const line = r.out.split("\n").find((l) => /written\s+\.claude\/bin\/git ·/.test(l)) || "";
  assert.match(line, /the night puts first on its PATH/, r.out);
  assert.match(line, /force push, --no-verify and moving core\.hooksPath/);
  assert.match(line, /your shell's git is untouched/);
});

test("the install step holds typescript below 7, and a repository that has it is not asked again", () => {
  const bare = tempRepo("init-ts", { "package.json": NEXT_PKG });
  const r = cli(["init", "--profile", "synovitec", bare, "--stack", "next"], bare);
  assert.match(r.out, /\d+\. npm i -D [^\n]*\btypescript@\^6\b/, r.out);
  const pkg = { ...JSON.parse(NEXT_PKG), devDependencies: { typescript: "^5.6.0" } };
  const has = tempRepo("init-has-ts", { "package.json": JSON.stringify(pkg) });
  const line = cli(["init", "--profile", "synovitec", has, "--stack", "next"], has)
    .out.split("\n")
    .find((l) => /npm i -D/.test(l));
  assert.doesNotMatch(String(line), /typescript/);
});
