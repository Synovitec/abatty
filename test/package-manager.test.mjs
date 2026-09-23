import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { commandFor, managerFor, packageManager } from "../src/core/package-manager.mjs";

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

test("an npm command is written in the repository's own manager, and npm's are left as they are", () => {
  const bun = managerFor(tempRepo("pm-bun-cmd", { "package.json": PKG, "bun.lock": "{}\n" }));
  assert.equal(bun.id, "bun");
  assert.equal(commandFor("npm run gate:fast", bun), "bun run --silent gate:fast");
  assert.equal(commandFor("npm test", bun), "bun run --silent test");
  assert.equal(commandFor("npx eslint --max-warnings=0", bun), "bunx eslint --max-warnings=0");
  assert.equal(commandFor("make lint", bun), "make lint", "not an npm command: untouched");
  const npm = managerFor(tempRepo("pm-none-cmd", { "package.json": PKG }));
  assert.equal(npm.id, "npm", "nothing committed names one: npm");
  assert.equal(commandFor("npm run gate:fast", npm), "npm run gate:fast");
});

test("init writes a bun repository's hooks and commands in bun's words", () => {
  const dir = tempRepo("pm-bun-init", {
    "package.json": JSON.stringify({
      name: "b",
      packageManager: "bun@1.2.0",
      dependencies: { next: "15.0.0" },
    }),
    "bun.lock": "{}\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const hooks = ["pre-commit", "pre-push", "commit-msg"].map((h) =>
    readFileSync(join(dir, ".githooks", h), "utf8"),
  );
  assert.ok(
    hooks.every(
      (h) =>
        !/\bnpx\b|\bnpm run\b/.test(
          h
            .split("\n")
            .filter((l) => !l.startsWith("#"))
            .join("\n"),
        ),
    ),
  );
  assert.match(hooks[1] || "", /^bun run --silent gate --refs$/m);
  const cfg = JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8"));
  assert.equal(cfg.commands.gate, "bun run --silent gate:fast");
});
