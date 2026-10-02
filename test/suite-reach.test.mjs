import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { unreachableSuites } from "../src/core/suite-reach.mjs";
import { presetById } from "../src/presets/index.mjs";

// A monorepo whose Next app lives in a workspace with no preset of its own: the browser suite's
// paths (app/, e2e/) are read from the root, matched nothing, and the suite never ran while the
// rule it backs read present. The first full run found 25 real page errors.

const next = presetById("next");
const scripts = { build: "turbo run build", "test:e2e": "turbo run e2e" };
const mono = (/** @type {Record<string, string>} */ files) =>
  tempRepo("reach", {
    "package.json": JSON.stringify({ ...JSON.parse(NEXT_PKG), scripts }),
    ...files,
  });

test("a suite whose scripts exist and whose paths match nothing here is named, doctor says so", () => {
  const dir = mono({
    "apps/web/app/page.tsx": "export default function P() { return null; }\n",
    "apps/web/tests/e2e/home.spec.ts": "test('x', () => {});\n",
  });
  const names = unreachableSuites(dir, next).map((u) => u.name);
  assert.ok(
    names.some((n) => /browser/i.test(n)),
    names.join(", "),
  );
  const doc = cli(["doctor", dir, "--skip-self-test", "--stack", "next"], dir);
  assert.match(doc.out, /the gate can never select [^\n]*browser[^\n]*"test:e2e" script/i);
});

test("an app at the root, or a repository without the suite's scripts, is not named", () => {
  const root = mono({ "app/page.tsx": "export default function P() { return null; }\n" });
  assert.deepEqual(unreachableSuites(root, next), []);
  const none = tempRepo("reach-none", { "package.json": NEXT_PKG });
  assert.deepEqual(unreachableSuites(none, next), [], "no e2e script: no suite to reach");
});

test("the gate selects the browser suite under the app's workspace, and doctor stops naming it", () => {
  const files = {
    "apps/web/next.config.ts": "export default {};\n",
    "apps/web/app/page.tsx": "export default function P() { return null; }\n",
  };
  const dir = mono(files);
  assert.deepEqual(unreachableSuites(dir, next), [], "the app's home makes it reachable");
  const base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "apps/web/app/page.tsx"), "export default function P() { return 1; }\n");
  git(dir, "commit", "-qam", "feat: the page");
  /** @type {string[]} */
  const ran = [];
  const r = runGate({
    repoDir: dir,
    preset: /** @type {any} */ ({ ...next, gate: { always: [], suites: next?.gate.suites } }),
    range: `${base}..HEAD`,
    workspaces: [{ path: "apps/web", preset: null }],
    log: () => {},
    run: (_cwd, script) => {
      ran.push(String(script));
      return 0;
    },
    dockerUp: () => false,
  });
  const browser = r.events.find((e) => /browser/i.test(e.label) || /E2E/.test(e.label));
  // Selected: run, or deferred for want of Docker on this machine, never "no matching path".
  assert.ok(browser && browser.outcome !== "skipped", JSON.stringify(r.events));
  // The control: the same push without the marker reads no app home, and the suite is skipped.
  const bare = mono({ "apps/web/app/page.tsx": files["apps/web/app/page.tsx"] });
  const b0 = git(bare, "rev-parse", "HEAD");
  writeFileSync(join(bare, "apps/web/app/page.tsx"), "export default function P() { return 1; }\n");
  git(bare, "commit", "-qam", "feat: the page");
  /** @type {string[]} */
  const ranBare = [];
  const rb = runGate({
    repoDir: bare,
    preset: /** @type {any} */ ({ ...next, gate: { always: [], suites: next?.gate.suites } }),
    range: `${b0}..HEAD`,
    workspaces: [{ path: "apps/web", preset: null }],
    log: () => {},
    run: (_cwd, script) => {
      ranBare.push(String(script));
      return 0;
    },
    dockerUp: () => false,
  });
  const skipped = rb.events.find((e) => /browser/i.test(e.label));
  assert.equal(skipped?.outcome, "skipped", JSON.stringify(rb.events));
  assert.equal(ranBare.length, 0);
});
