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
    assert.doesNotMatch(text, /NPM_TOKEN|NODE_AUTH_TOKEN/, `${f} names a stored publish token`);
  }
  assert.deepEqual(unpinned("steps:\n  - uses: actions/checkout@v4\n  - uses: ./local\n"), [
    "actions/checkout@v4",
  ]);
});
