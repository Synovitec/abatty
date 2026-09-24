import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// What the package promises about itself, where it runs inside every adopter's hooks: no runtime
// dependency (CLAUDE.md §1.1), no script that runs when it is installed (both npm worms of 2025
// spread through those), every workflow action pinned to a commit, and a publish with no stored
// token. Each check is also run on a fixture that breaks it, so it is watched failing.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL_HOOKS = [
  "preinstall",
  "install",
  "postinstall",
  "preprepare",
  "prepare",
  "postprepare",
];

/** What the package's own manifest breaks of the promise. @param {any} pkg */
function manifestBreaks(pkg) {
  const deps = Object.keys(pkg.dependencies || {}).map((d) => `dependency ${d}`);
  const hooks = INSTALL_HOOKS.filter((s) => pkg.scripts?.[s]).map((s) => `install script ${s}`);
  return [...deps, ...hooks];
}

/** The `uses:` of a workflow that are not pinned to a full commit. @param {string} text */
function unpinned(text) {
  return [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)]
    .map((m) => String(m[1]))
    .filter((u) => !u.startsWith("./") && !/@[0-9a-f]{40}$/.test(u));
}

test("the package has no runtime dependency and runs nothing when installed", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(manifestBreaks(pkg), []);
  assert.deepEqual(
    manifestBreaks({ dependencies: { left: "1" }, scripts: { postinstall: "node x", test: "t" } }),
    ["dependency left", "install script postinstall"],
    "the check sees what it guards",
  );
});

test("every workflow action is pinned to a commit, and the release stores no token", () => {
  const dir = join(ROOT, ".github/workflows");
  for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const text = readFileSync(join(dir, f), "utf8");
    assert.deepEqual(unpinned(text), [], f);
    assert.equal(storesToken(text), false, `${f} names a stored publish token`);
  }
  assert.deepEqual(unpinned("steps:\n  - uses: actions/checkout@v4\n  - uses: ./local\n"), [
    "actions/checkout@v4",
  ]);
  // Every spelling a token takes, caught: the check sees what it guards.
  for (const spelling of [
    "env:\n  NPM_CONFIG_TOKEN: ${{ secrets.PUBLISH }}\n",
    "run: echo //registry.npmjs.org/:_authToken=x > .npmrc\n",
    "env:\n  NODE_AUTH_TOKEN: x\n",
  ])
    assert.equal(storesToken(spelling), true, spelling);
});

test("the release job that runs the dev dependencies never holds the publishing identity", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
  const jobs = Object.fromEntries(
    text
      .split(/\n(?= {2}[\w-]+:\n)/)
      .slice(1)
      .map((block) => [String(/^ {2}([\w-]+):/.exec(block)?.[1]), block]),
  );
  assert.doesNotMatch(String(jobs.gate), /id-token/, "the gate job has no identity");
  assert.match(String(jobs.gate), /npm run -s gate/);
  assert.match(String(jobs.publish), /id-token: write/);
  assert.match(String(jobs.publish), /needs: gate/);
  assert.match(String(jobs.publish), /npm publish [^\n]*--ignore-scripts/);
  assert.doesNotMatch(
    String(jobs.publish),
    /npm (ci|install)(?! -g npm@)/,
    "no dependency installed",
  );
  assert.doesNotMatch(
    text.split("jobs:")[0] || "",
    /id-token/,
    "no identity for the whole workflow",
  );
});

/** A publish credential stored anywhere in a workflow, in any of its spellings. @param {string} text */
function storesToken(text) {
  return /NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_\w*TOKEN|_authToken/i.test(text);
}

test("only the job that uploads findings may write them", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/checks.yml"), "utf8");
  const [header = "", jobs = ""] = text.split(/\njobs:\n/);
  assert.doesNotMatch(header, /security-events/, "not granted to the whole workflow");
  const gate = jobs.split(/\n(?= {2}[\w-]+:\n)/).find((b) => /^\s*gate:/.test(b)) || "";
  assert.match(gate, /security-events: write/);
  assert.match(gate, /upload-sarif/);
});
