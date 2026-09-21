import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import {
  affectedWorkspaces,
  detectWorkspaces,
  workspaceFolders,
  workspaceGlobs,
  workspaceGraph,
} from "../src/presets/workspaces.mjs";

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
    "package-lock.json": "{}\n",
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
      calls.push([cwd.slice(dir.length).replace(/\\/g, "/"), script]);
      return 0;
    },
    audit: () => ({ status: 0, output: "" }),
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
    run: (cwd, script) => (/services[\\/]api$/.test(cwd) && script === "test" ? 1 : 0),
    audit: () => ({ status: 0, output: "" }),
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
    audit: () => ({ status: 0, output: "" }),
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

test("a change under a shared package selects the application that imports it", () => {
  // Selection by path answers which inputs changed. Which workspaces can observe them is the
  // other half, and without it the gate let work through it was installed to refuse, silently.
  const dir = tempRepo("affected", {
    "package.json": JSON.stringify({
      name: "mono",
      private: true,
      workspaces: ["apps/*", "packages/*"],
    }),
    "apps/store/package.json": JSON.stringify({ name: "@m/store", dependencies: { "@m/ui": "*" } }),
    "apps/docs/package.json": JSON.stringify({ name: "@m/docs" }),
    "packages/ui/package.json": JSON.stringify({ name: "@m/ui", dependencies: { "@m/core": "*" } }),
    "packages/core/package.json": JSON.stringify({ name: "@m/core" }),
  });
  const ws = detectWorkspaces(dir, null);
  const graph = workspaceGraph(dir, ws);
  assert.deepEqual([...(graph.edges.get("apps/store") || [])], ["packages/ui"]);
  assert.deepEqual([...(graph.edges.get("packages/ui") || [])], ["packages/core"]);

  // One hop: the package changed, the application that imports it is selected.
  const one = affectedWorkspaces(dir, ws, ["packages/ui/src/button.tsx"]);
  assert.deepEqual([...one.selected].sort(), ["apps/store", "packages/ui"]);
  assert.equal(one.viaGraph.get("apps/store"), "packages/ui");
  assert.equal(one.everything, null);

  // Two hops: the transitive dependent is selected too, which is the case a one-level check misses.
  const two = affectedWorkspaces(dir, ws, ["packages/core/index.ts"]);
  assert.deepEqual([...two.selected].sort(), ["apps/store", "packages/core", "packages/ui"]);

  // The control in the other direction: a workspace nothing depends on selects only itself.
  const leaf = affectedWorkspaces(dir, ws, ["apps/docs/page.mdx"]);
  assert.deepEqual([...leaf.selected], ["apps/docs"]);

  // A change outside every workspace is not narrowed, and the reason is stated rather than implied.
  const root = affectedWorkspaces(dir, ws, ["tsconfig.json"]);
  assert.equal(root.selected.size, 4);
  assert.match(String(root.everything), /outside every workspace/);
});

test("the gate runs the application's suites when only the package it imports changed", () => {
  // The end of the same story, at the gate rather than at the selection: the suite of an
  // application whose own folder nobody touched still runs, and the output says why it was
  // selected rather than leaving a reader to infer it.
  const dir = tempRepo("affected-gate", {
    "package.json": JSON.stringify({
      name: "mono",
      private: true,
      workspaces: ["apps/*", "packages/*"],
      scripts: { test: "true" },
    }),
    "package-lock.json": "{}\n",
    "apps/store/package.json": JSON.stringify({
      name: "@m/store",
      dependencies: { "@m/ui": "*", next: "15" },
      scripts: { test: "true" },
    }),
    "packages/ui/package.json": JSON.stringify({ name: "@m/ui", scripts: { test: "true" } }),
    "apps/store/e2e/checkout.spec.ts": "test('x', () => {});\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  // The only change is inside the package the application imports.
  writeFileSync(join(dir, "packages/ui/button.tsx"), "export const Button = () => null;\n");
  const preset = presetById("node");
  assert.ok(preset);
  /** @type {string[]} */
  const lines = [];
  const r = runGate({
    repoDir: dir,
    preset,
    workspaces: detectWorkspaces(dir, null),
    run: () => 0,
    audit: () => ({ status: 0, output: "" }),
    dockerUp: () => false,
    log: (l) => lines.push(l),
  });
  assert.equal(r.ok, true, JSON.stringify(r.events));
  const said = lines.join("\n");
  assert.match(said, /apps\/store.*selected by the workspace graph/s);
  assert.match(said, /packages\/ui changed and apps\/store depends on it/);
  assert.ok(
    !r.events.some(
      (e) =>
        e.label.startsWith("apps/store · ") &&
        e.detail === "no matching path in the push or the tree",
    ),
    "the application's suites are not skipped: " + JSON.stringify(r.events),
  );
});
