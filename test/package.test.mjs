import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/[\/]$/, "");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

/** @param {string[]} args @param {string} cwd */
function run(args, cwd) {
  const r = spawnSync(npm, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

test("the tarball a third party installs: what the CLI needs and nothing of the repository's own; installed in a clean project, init runs from it", () => {
  const dest = mkdtempSync(join(tmpdir(), "abatty-pack-"));
  const packed = run(["pack", "--json", "--pack-destination", dest], ROOT);
  assert.equal(packed.code, 0, packed.out);
  const info = JSON.parse(packed.out.slice(packed.out.indexOf("[")))[0];
  /** @type {string[]} */
  const files = info.files.map((/** @type {{ path: string }} */ f) => String(f.path));
  for (const must of [
    "bin/abatty.mjs",
    "src/index.mjs",
    "src/night/runner.mjs",
    "templates/harness/hooks/guard.mjs",
    "templates/harness/testing/stub-agent.mjs",
    "templates/skills/adopt-standards/SKILL.md",
    "schema/abatty.config.schema.json",
    "types/src/index.d.mts",
    "docs/standard/ENGINEERING_STANDARD.md",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "package.json",
  ])
    assert.ok(files.includes(must), `${must} in the tarball`);
  for (const never of [
    /^test\//,
    /^scripts\//,
    /^\.github\//,
    /^\.githooks\//,
    /^abatty\.config\.json$/,
    /^docs\/ROADMAP\.md$/,
    /^tsconfig/,
    /^node_modules\//,
  ])
    assert.ok(!files.some((f) => never.test(f)), `${never} out of the tarball`);
  assert.ok(files.length < 400, `a tarball of ${files.length} files: check the files field`);

  const project = mkdtempSync(join(tmpdir(), "abatty-consumer-"));
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "consumer", private: true }) + "\n",
  );
  spawnSync("git", ["init", "-q"], { cwd: project });
  const installed = run(
    ["install", "--no-audit", "--no-fund", "--ignore-scripts", join(dest, info.filename)],
    project,
  );
  assert.equal(installed.code, 0, installed.out);
  const bin = join(project, "node_modules", "abatty", "bin", "abatty.mjs");
  assert.ok(existsSync(bin), "the bin in the installed package");
  const version = spawnSync(process.execPath, [bin, "--version"], {
    cwd: project,
    encoding: "utf8",
  });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /\d+\.\d+\.\d+/);
  const init = spawnSync(process.execPath, [bin, "init", project, "--stack", "node"], {
    cwd: project,
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.ok(
    existsSync(join(project, "abatty.config.json")),
    "the config written from the installed templates",
  );
  assert.ok(existsSync(join(project, ".claude", "hooks", "guard.mjs")), "the hooks copied");
  const lock = JSON.parse(readFileSync(join(project, ".claude", "harness.lock.json"), "utf8"));
  assert.equal(lock.abatty, info.version, "the lock pins the installed version");
});
