import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
import { commentOnly, liveDevServer } from "../src/core/suite-select.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";

const LOCK = ".next/dev/lock";

/** A pid that existed and has exited: a lock a crash left behind. */
function deadPid() {
  return spawnSync(process.execPath, ["-e", "process.exit(0)"]).pid;
}

/** @param {string} dir @param {unknown} content */
function lock(dir, content) {
  mkdirSync(join(dir, ".next", "dev"), { recursive: true });
  writeFileSync(join(dir, LOCK), typeof content === "string" ? content : JSON.stringify(content));
}

test("a dev server is live only while the pid its lock names is alive", () => {
  const dir = tempRepo("dev-live", {});
  assert.equal(liveDevServer(dir, [LOCK]), null, "no lock");
  lock(dir, { pid: process.pid, port: 3000 });
  assert.deepEqual(liveDevServer(dir, [LOCK]), { lock: LOCK, pid: process.pid, port: 3000 });
  assert.equal(liveDevServer(dir, []), null, "a suite that names no lock is never deferred");
  lock(dir, { pid: deadPid(), port: 3000 });
  assert.equal(liveDevServer(dir, [LOCK]), null, "a lock a crash left behind");
  lock(dir, "not json");
  assert.equal(liveDevServer(dir, [LOCK]), null, "a lock this cannot read");
});

/** A repository with one pushed commit on top of its first, changing app/page.tsx by `edit`. */
function pushed(/** @type {string} */ name, /** @type {(text: string) => string} */ edit) {
  const page = "// the landing page\nexport const Page = () => 1;\n";
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({
      name: "s",
      scripts: { test: "true", typecheck: "true", standards: "true", build: "true", e2e: "true" },
    }),
    "package-lock.json": "{}\n",
    "app/page.tsx": page,
  });
  writeFileSync(join(dir, "app", "page.tsx"), edit(page));
  git(dir, "commit", "-qam", "change the page");
  return dir;
}

test("a file whose diff is only comments or blank lines is comment-only, and a code line is not", () => {
  const reworded = pushed("comment-only", (t) => t.replace("the landing page", "the home page"));
  assert.deepEqual([...commentOnly(reworded, "HEAD~1..HEAD", ["app/page.tsx"])], ["app/page.tsx"]);
  const code = pushed("code-change", (t) => t.replace("=> 1", "=> 2"));
  assert.equal(commentOnly(code, "HEAD~1..HEAD", ["app/page.tsx"]).size, 0);
  const both = pushed("comment-and-code", (t) =>
    t.replace("landing", "home").replace("=> 1", "=> 2"),
  );
  assert.equal(
    commentOnly(both, "HEAD~1..HEAD", ["app/page.tsx"]).size,
    0,
    "one code line is enough",
  );
});

/** @param {string} dir */
function gate(dir) {
  /** @type {string[]} */
  const ran = [];
  const r = runGate({
    repoDir: dir,
    preset: /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next")),
    range: "HEAD~1..HEAD",
    run: (_d, script) => {
      ran.push(script);
      return 0;
    },
    audit: () => ({ status: 0, output: "" }),
    dockerUp: () => true,
    log: () => {},
  });
  const suite = r.events.find((e) => /browser suite/.test(e.label));
  return { r, suite, built: ran.includes("build") };
}

test("the gate runs no build for a push that only rewords a comment, and builds for code", () => {
  const quiet = gate(pushed("gate-comment", (t) => t.replace("landing", "home")));
  assert.equal(quiet.suite?.outcome, "skipped");
  assert.equal(quiet.built, false);
  const loud = gate(pushed("gate-code", (t) => t.replace("=> 1", "=> 2")));
  assert.equal(loud.built, true);
});

test("the gate defers the build to CI while a dev server serves the checkout, and says which", () => {
  const dir = pushed("gate-dev", (t) => t.replace("=> 1", "=> 2"));
  lock(dir, { pid: process.pid, port: 3000 });
  const live = gate(dir);
  assert.equal(live.suite?.outcome, "deferred");
  assert.match(String(live.suite?.detail), /dev server is running .*port 3000/);
  assert.equal(live.built, false);
  assert.equal(live.r.ok, true, "deferred loudly, not red");
  lock(dir, { pid: deadPid() });
  assert.equal(gate(dir).built, true, "a stale lock defers nothing");
});
