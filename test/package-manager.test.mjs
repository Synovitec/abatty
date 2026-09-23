import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { packageManager } from "../src/core/package-manager.mjs";

const PKG = JSON.stringify({ name: "p", private: true });

test("the package manager is read from what the repository committed: the field first, the lockfile otherwise, nothing guessed", () => {
  assert.equal(packageManager(tempRepo("pm-none", { "package.json": PKG })), null);
  const npm = packageManager(
    tempRepo("pm-npm", { "package.json": PKG, "package-lock.json": "{}" }),
  );
  assert.equal(npm?.id, "npm");
  assert.deepEqual(npm?.install, ["npm", "ci"]);
  const pnpm = packageManager(
    tempRepo("pm-pnpm", { "package.json": PKG, "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" }),
  );
  assert.equal(pnpm?.id, "pnpm");
  assert.deepEqual(pnpm?.install, ["pnpm", "install", "--frozen-lockfile"]);
  assert.deepEqual(pnpm?.audit?.("high").check, ["pnpm", "audit", "--audit-level=high", "--prod"]);
  const bun = packageManager(tempRepo("pm-bun", { "package.json": PKG, "bun.lock": "{}" }));
  assert.equal(bun?.id, "bun");
  assert.deepEqual(bun?.run("gate"), ["bun", "run", "--silent", "gate"]);

  // The field wins over a lockfile another tool left behind.
  const declared = packageManager(
    tempRepo("pm-field", {
      "package.json": JSON.stringify({ name: "p", packageManager: "pnpm@9.12.0" }),
      "package-lock.json": "{}",
    }),
  );
  assert.equal(declared?.id, "pnpm");
});

test("yarn 1 and yarn berry are told apart by the lockfile, each with the audit it was watched to run", () => {
  const classic = packageManager(
    tempRepo("pm-yarn1", { "package.json": PKG, "yarn.lock": "# yarn lockfile v1\n" }),
  );
  assert.deepEqual(classic?.install, ["yarn", "install", "--frozen-lockfile"]);
  const c = classic?.audit?.("high");
  assert.equal(c?.byJson, true, "yarn 1's exit code ignores the floor: the report decides");
  assert.deepEqual(c?.check.slice(0, 3), ["yarn", "audit", "--json"]);
  // the pipeline reads the same bitmask: 8 and up is high or critical
  assert.match(
    classic?.auditCommand || "",
    /^yarn audit --groups dependencies --level high \|\| \[ \$\? -lt 8 \]$/,
  );
  const berry = packageManager(
    tempRepo("pm-berry", { "package.json": PKG, "yarn.lock": "__metadata:\n  version: 8\n" }),
  );
  assert.deepEqual(berry?.install, ["yarn", "install", "--immutable"]);
  assert.equal(berry?.audit?.("high").byJson, undefined, "berry's code honours --severity");
  assert.match(berry?.auditCommand || "", /^yarn npm audit/);
});
