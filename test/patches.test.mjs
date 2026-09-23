import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";
import { stalePatches } from "../src/core/patches.mjs";

// An adopter patched abatty 0.4.0 in node_modules to get past a defect 0.5.0 fixed. On the
// upgrade the patch fails to apply, or applies to code it was never written for; nothing said so.

test("a patch of another abatty version is named wherever it is declared; one of this version is not", () => {
  const dir = tempRepo("patches", {
    "package.json": JSON.stringify({
      patchedDependencies: { "abatty@0.4.0": "patches/abatty@0.4.0.patch", "left-pad@1.0.0": "x" },
      pnpm: { patchedDependencies: { "abatty@0.5.1": "patches/abatty@0.5.1.patch" } },
    }),
    "patches/abatty@0.4.0.patch": "diff\n",
    "patches/abatty+0.3.3.patch": "diff\n",
    "patches/abatty@0.5.1.patch": "diff\n",
  });
  assert.deepEqual(
    stalePatches(dir, "0.5.1")
      .map((p) => `${p.patched} ${p.where}`)
      .sort(),
    [
      '0.4.0 package.json patchedDependencies "abatty@0.4.0"',
      "0.3.3 patches/abatty+0.3.3.patch",
      "0.4.0 patches/abatty@0.4.0.patch",
    ].sort(),
  );
  assert.deepEqual(stalePatches(tempRepo("no-patches", {}), "0.5.1"), []);
});

test("doctor names a stale patch of abatty", () => {
  const dir = tempRepo("patches-doctor", {
    "package.json": JSON.stringify({ patchedDependencies: { "abatty@0.0.1": "p.patch" } }),
  });
  const r = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(r.out, /a patch of abatty 0\.0\.1 is still declared/);
});
