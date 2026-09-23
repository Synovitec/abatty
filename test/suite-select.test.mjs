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

test("a line that only looks like a comment is code, and a file the lexer cannot read is never quiet", () => {
  const dir = tempRepo("comment-lookalike", {
    "src/sum.ts": "export const x = 1\n  * 2;\n",
    "src/a.css": "a { background: url(//cdn.example/one.png); }\n",
    "src/doc.ts": "/**\n * One line.\n */\nexport const y = 1;\n",
  });
  writeFileSync(join(dir, "src", "sum.ts"), "export const x = 1\n  * 3;\n");
  // A protocol-relative URL is a comment to a JavaScript lexer, and a change of asset to CSS.
  writeFileSync(join(dir, "src", "a.css"), "a { background: url(//cdn.example/two.png); }\n");
  writeFileSync(
    join(dir, "src", "doc.ts"),
    "/**\n * Two lines,\n * now.\n */\nexport const y = 1;\n",
  );
  git(dir, "commit", "-qam", "change");
  const quiet = commentOnly(dir, "HEAD~1..HEAD", ["src/sum.ts", "src/a.css", "src/doc.ts"]);
  assert.deepEqual([...quiet], ["src/doc.ts"]);
  assert.equal(commentOnly(dir, "HEAD~1...HEAD", ["src/doc.ts"]).size, 0, "a three-dot range");
});

test("text the lexer mistakes for a comment, and a directive comment, keep the suites", () => {
  /** @type {Record<string, [string, string]>} file: [before, after] */
  const cases = {
    // `\//` inside a regular expression literal reads as the start of a line comment
    "src/re.ts": [
      "export const ok = (s) => /https?:\/\//.test(s) && s.length > 10;\n",
      "export const ok = (s) => /https?:\/\//.test(s) && s.length > 100;\n",
    ],
    // a URL in JSX text reads the same way
    "src/link.tsx": [
      'export const L = () => <a href="/x">Visit https://old.example</a>;\n',
      'export const L = () => <a href="/x">Visit https://new.example</a>;\n',
    ],
    // a comment after code on the same line is not a whole-line comment
    "src/tail.ts": ["export const t = 1; // one\n", "export const t = 1; // two\n"],
    // adding a coverage ignore changes what the coverage step measures
    "src/cov.ts": ["// note\nexport const c = 1;\n", "/* v8 ignore next */\nexport const c = 1;\n"],
  };
  const files = Object.keys(cases);
  const dir = tempRepo(
    "comment-mistaken",
    Object.fromEntries(files.map((f) => [f, cases[f]?.[0] ?? ""])),
  );
  for (const f of files) writeFileSync(join(dir, f), cases[f]?.[1] ?? "");
  git(dir, "commit", "-qam", "change");
  assert.deepEqual([...commentOnly(dir, "HEAD~1..HEAD", files)], []);
});

/** @param {string} dir @param {boolean} [ci] */
function gate(dir, ci = false) {
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
    ci,
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
  // The shape `next dev` 16 writes, copied from a live lock on an adopter's checkout.
  lock(dir, {
    pid: process.pid,
    port: 3000,
    hostname: "localhost",
    appUrl: "http://localhost:3000",
    startedAt: 1790171006744,
  });
  assert.equal(gate(dir, true).built, true, "in CI a lock defers nothing");
  const live = gate(dir);
  assert.equal(live.suite?.outcome, "deferred");
  assert.match(String(live.suite?.detail), /dev server is running .*port 3000/);
  assert.equal(live.built, false);
  assert.equal(live.r.ok, true, "deferred loudly, not red");
  lock(dir, { pid: deadPid() });
  assert.equal(gate(dir).built, true, "a stale lock defers nothing");
});
