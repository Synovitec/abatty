import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import { detectWorkspaces, workspaceFolders, workspaceGlobs } from "../src/presets/workspaces.mjs";

/** @param {string} name @param {Record<string, unknown>} [rootExtra] */
function monorepo(name, rootExtra = {}) {
  const dir = tempRepo(name, {
    "package.json":
      JSON.stringify({
        name: "mono",
        private: true,
        workspaces: ["apps/*", "services/*", "packages/*"],
        scripts: { test: "node -e process.exit(0)" },
        ...rootExtra,
      }) + "\n",
    "apps/web/package.json":
      JSON.stringify({
        name: "web",
        scripts: { lint: "true", typecheck: "true", test: "true" },
        dependencies: { next: "15.0.0", react: "19.0.0" },
      }) + "\n",
    "apps/web/src/app/page.tsx": "export default function Page() { return null; }\n",
    "services/api/package.json":
      JSON.stringify({
        name: "api",
        scripts: { lint: "true", test: "true" },
        dependencies: { express: "4.0.0" },
      }) + "\n",
    "services/api/src/server.js": "module.exports = 1;\n",
    "packages/db/package.json":
      JSON.stringify({ name: "db", dependencies: { "drizzle-orm": "0.30.0" } }) + "\n",
    "packages/db/src/index.ts": "export const db = 1;\n",
  });
  return dir;
}

test("the workspaces are read from the root's workspaces field, a pnpm file, or the conventional folders; each detected from its own dependencies, the config winning", () => {
  const dir = monorepo("ws-detect");
  assert.deepEqual(workspaceGlobs(dir), ["apps/*", "services/*", "packages/*"]);
  assert.deepEqual(workspaceFolders(dir, workspaceGlobs(dir)), [
    "apps/web",
    "services/api",
    "packages/db",
  ]);
  const ws = detectWorkspaces(dir, null);
  assert.deepEqual(
    ws.map((w) => [w.path, w.presetId, w.from]),
    [
      ["apps/web", "next", "deps"],
      ["services/api", "node", "deps"],
      ["packages/db", "", "none"],
    ],
  );
  const named = detectWorkspaces(dir, { workspaces: { "packages/db": "node" } });
  assert.deepEqual(named.map((w) => [w.path, w.presetId, w.from])[2], [
    "packages/db",
    "node",
    "config",
  ]);

  const pnpm = tempRepo("ws-pnpm", {
    "package.json": JSON.stringify({ name: "p", private: true }) + "\n",
    "pnpm-workspace.yaml": "packages:\n  - 'libs/*'\n  - 'tools/cli'\n",
    "libs/a/package.json": JSON.stringify({ name: "a" }) + "\n",
    "tools/cli/package.json": JSON.stringify({ name: "cli" }) + "\n",
  });
  assert.deepEqual(workspaceGlobs(pnpm), ["libs/*", "tools/cli"]);
  assert.deepEqual(workspaceFolders(pnpm, workspaceGlobs(pnpm)), ["libs/a", "tools/cli"]);
  const plain = tempRepo("ws-conventional", {
    "package.json": JSON.stringify({ name: "p", private: true }) + "\n",
    "packages/x/package.json": JSON.stringify({ name: "x" }) + "\n",
  });
  assert.deepEqual(workspaceGlobs(plain), ["apps/*", "packages/*", "services/*"]);
  assert.deepEqual(workspaceFolders(plain, workspaceGlobs(plain)), ["packages/x"]);
});

test("the gate composes: the root's steps, then each workspace's preset in its own folder; the built-in steps and the ratchet once at the root; a workspace without a preset is not gated", () => {
  const dir = monorepo("ws-gate");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  const preset = presetById("node");
  assert.ok(preset);
  /** @type {[string, string][]} */
  const calls = [];
  const r = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, null),
    fast: true,
    run: (cwd, script) => {
      calls.push([cwd.slice(dir.length), script]);
      return 0;
    },
    dockerUp: () => false,
    log: () => {},
  });
  assert.equal(r.ok, true, JSON.stringify(r.events));
  assert.deepEqual(calls, [
    ["", "test"],
    ["/apps/web", "lint"],
    ["/apps/web", "typecheck"],
    ["/apps/web", "test"],
    ["/services/api", "lint"],
    ["/services/api", "test"],
  ]);
  const labels = r.events.map((e) => e.label);
  assert.ok(
    labels.some((l) => l === "secret scan (SEC.1)"),
    "the built-in scan at the root",
  );
  assert.ok(!labels.some((l) => /apps\/web · secret scan/.test(l)), "not per workspace");
  assert.ok(labels.some((l) => /^apps\/web · lint/.test(l)));
  assert.ok(!labels.some((l) => /packages\/db/.test(l)), "no preset, not gated");
  assert.ok(
    labels.some((l) => /apps\/web · build \+ browser suite/.test(l)),
    "the workspace's suites listed under --fast",
  );

  // A failing step in a workspace ends the gate, named.
  const red = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, null),
    fast: true,
    run: (cwd, script) => (cwd.endsWith("services/api") && script === "test" ? 1 : 0),
    log: () => {},
  });
  assert.equal(red.ok, false);
  assert.equal(red.events.at(-1)?.label, "services/api · unit tests (TEST.1)");
  assert.equal(red.events.at(-1)?.outcome, "failed");

  // The suites are path-aware under the workspace's folder: a pending file there selects it.
  writeFileSync(
    join(dir, "apps/web/src/app/layout.tsx"),
    "export default function Layout() { return null; }\n",
  );
  const suites = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, null),
    run: () => 0,
    dockerUp: () => false,
    log: () => {},
  });
  const web = suites.events.find((e) => /apps\/web · build \+ browser suite/.test(e.label));
  assert.equal(
    web?.outcome,
    "deferred",
    "apps/web/src/app/ is under the suite's paths; no Docker defers it",
  );
});

test("init writes each workspace's preset scripts in its own package.json; the status screen lists the workspaces; the report carries them", () => {
  const dir = monorepo("ws-init");
  const init = cli(["init", dir, "--stack", "node"], dir);
  assert.equal(init.code, 0, init.out);
  const web = JSON.parse(readFileSync(join(dir, "apps/web/package.json"), "utf8"));
  assert.equal(web.scripts.lint, "true", "an existing script is kept");
  assert.equal(web.scripts.dead, "knip --max-issues 0", "the preset's script added");
  assert.equal(web.scripts.gate, undefined, "the gate stays at the root");
  const db = JSON.parse(readFileSync(join(dir, "packages/db/package.json"), "utf8"));
  assert.equal(db.scripts, undefined, "no preset, nothing written");
  assert.match(init.out, /apps\/web\/package\.json/);
  const status = cli(["status", dir, "--fresh"], dir);
  assert.match(status.out, /workspaces\s+apps\/web next \(detected\)/);
  assert.match(status.out, /packages\/db no preset · not gated/);
  const report = JSON.parse(cli(["measure", dir, "--json"], dir).out);
  assert.deepEqual(
    report.workspaces.map((/** @type {{ path: string, preset: string }} */ w) => [
      w.path,
      w.preset,
    ]),
    [
      ["apps/web", "next"],
      ["services/api", "node"],
      ["packages/db", ""],
    ],
  );
});

test("the docs preset: chosen for a repository with no package and no sources, its gate the format check, the document probes and the secret scan", () => {
  const dir = tempRepo("ws-docs", {
    "README.md": "# A standard\n",
    "docs/decisions.md": "# Decisions\n",
  });
  const init = cli(["init", dir], dir);
  assert.equal(init.code, 0, init.out);
  assert.match(init.out, /Documents \(design stage/);
  assert.match(init.out, /not yet proven/);
  const cfg = JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8"));
  assert.equal(cfg.stack, "docs");
  assert.equal(cfg.stage, "design");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.private, true, "a private package written for the scripts");
  assert.equal(pkg.scripts.standards, "abatty ratchet");
  const preset = presetById("docs");
  assert.ok(preset);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  const r = runGate({ repoDir: dir, preset, run: () => 0, log: () => {} });
  assert.equal(r.ok, true, JSON.stringify(r.events));
  assert.deepEqual(
    r.events.map((e) => [e.label.replace(/ \(.*/, "").slice(0, 22), e.outcome]),
    [
      ["format", "skipped"],
      ["abatty ratchet: the do", "ok"],
      ["secret scan", "ok"],
    ],
  );
});
