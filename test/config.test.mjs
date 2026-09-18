import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import {
  CONFIG_FILE,
  LEGACY_CONFIG,
  configProblems,
  migrateConfig,
  readConfig,
  validateConfig,
} from "../src/core/config.mjs";

test("the schema refuses a wrong type, an unknown key and a value out of range, and accepts the template and this package's own config", () => {
  assert.deepEqual(
    validateConfig({ baseBranch: "main", phases: [0, "A.1"], scrub: { enabled: false } }),
    [],
  );
  assert.match(
    validateConfig({ baseBranch: 3 })[0] || "",
    /baseBranch: expected string, got integer/,
  );
  assert.match(validateConfig({ nonsense: true })[0] || "", /nonsense: not a known key/);
  assert.match(validateConfig({ maxStopBlocks: 9 })[0] || "", /maxStopBlocks: above 8/);
  assert.match(validateConfig({ ratchet: { kinds: [{ match: "x" }] } })[0] || "", /missing kind/);
  assert.deepEqual(
    validateConfig({ $schema: "x", $comment: "y", ratchet: { $comment: "z" } }),
    [],
    "$-keys are notes, anywhere",
  );
  const template = JSON.parse(
    readFileSync(new URL("../templates/harness/adoption.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(validateConfig(template), []);
  const own = JSON.parse(readFileSync(new URL("../abatty.config.json", import.meta.url), "utf8"));
  assert.deepEqual(validateConfig(own), []);
});

test("the root file wins key by key over the older place, and both are read", () => {
  const dir = tempRepo("config-merge", {
    "package.json": NEXT_PKG,
    [LEGACY_CONFIG]: JSON.stringify({
      baseBranch: "develop",
      commands: { gate: "npm run old", test: "npm test" },
      phases: [1, 2],
    }),
    [CONFIG_FILE]: JSON.stringify({ commands: { gate: "npm run new" }, scrub: { enabled: true } }),
  });
  const c = readConfig(dir);
  assert.ok(c);
  assert.equal(c.baseBranch, "develop", "from the older place");
  assert.equal(c.commands.gate, "npm run new", "the root wins");
  assert.equal(c.commands.test, "npm test", "deep: the older place's sibling key stays");
  assert.deepEqual(c.phases, [1, 2]);
  assert.equal(c.scrub.enabled, true);
  assert.equal(readConfig(tempRepo("config-none", { "package.json": NEXT_PKG })), null);
});

test("init writes the one config at the root with the schema line; the hooks and the stub read it there", () => {
  const dir = tempRepo("config-init", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  assert.ok(existsSync(join(dir, CONFIG_FILE)));
  assert.equal(existsSync(join(dir, LEGACY_CONFIG)), false, "one config, not two");
  const c = JSON.parse(readFileSync(join(dir, CONFIG_FILE), "utf8"));
  assert.equal(c.$schema, "https://abatty.io/schema/abatty.config.json");
  assert.equal(c.stack, "next");
  assert.deepEqual(configProblems(dir), []);
  // the guard keeps the root config read-only at night and reads its policy from it
  /** @param {string} cmd @param {boolean} night */
  const guard = (cmd, night) =>
    JSON.parse(
      spawnSync(process.execPath, [".claude/hooks/guard.mjs"], {
        cwd: dir,
        input: JSON.stringify({ tool_name: "Bash", tool_input: { command: cmd } }),
        encoding: "utf8",
        env: {
          ...process.env,
          ADOPTION_CONFIG: "",
          ADOPTION_RUN: night ? "1" : "",
          ADOPTION_BRANCH: "adopt/standards-x",
        },
      }).stdout || "{}",
    ).hookSpecificOutput?.permissionDecision || "none";
  assert.equal(guard("echo x > abatty.config.json", true), "deny");
  assert.equal(guard("cat abatty.config.json", true), "none");
  assert.equal(guard("echo x > abatty.config.json", false), "none");
  // the self-test reads the root config
  const st = spawnSync(process.execPath, [".claude/hooks/self-test.mjs"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, ADOPTION_CONFIG: "", ABATTY_AGENT: process.env.ABATTY_AGENT || "" },
  });
  assert.match(st.stdout + st.stderr, /adoption parse: abatty\.config\.json/);
});

test("abatty config: the files, the problems, --migrate moves the older place to the root and keeps the root's values", () => {
  const dir = tempRepo("config-cli", { "package.json": NEXT_PKG });
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(
    join(dir, LEGACY_CONFIG),
    JSON.stringify({ baseBranch: "develop", commands: { gate: "npm run gate:fast" }, phases: [0] }),
  );
  const before = cli(["config", dir], dir);
  assert.equal(before.code, 0, before.out);
  assert.match(before.out, /the older place; abatty config --migrate/);
  writeFileSync(join(dir, LEGACY_CONFIG), JSON.stringify({ baseBranch: 1 }));
  const bad = cli(["config", dir], dir);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /baseBranch: expected string/);
  writeFileSync(
    join(dir, LEGACY_CONFIG),
    JSON.stringify({ baseBranch: "develop", commands: { gate: "npm run gate:fast" }, phases: [0] }),
  );
  writeFileSync(join(dir, CONFIG_FILE), JSON.stringify({ commands: { gate: "npm run mine" } }));
  const m = migrateConfig(dir);
  assert.equal(m.moved, true);
  assert.equal(existsSync(join(dir, LEGACY_CONFIG)), false);
  const after = JSON.parse(readFileSync(join(dir, CONFIG_FILE), "utf8"));
  assert.equal(after.baseBranch, "develop");
  assert.equal(after.commands.gate, "npm run mine", "the root's values win");
  assert.equal(after.$schema, "https://abatty.io/schema/abatty.config.json");
  const json = JSON.parse(cli(["config", dir, "--json"], dir).out);
  assert.deepEqual(json.files, [CONFIG_FILE]);
  assert.deepEqual(json.problems, []);
  git(dir, "status");
});

test("the hooks read the repository's config, not a path settings.json pinned", () => {
  // init writes abatty.config.json at the root. settings.json pinning ADOPTION_CONFIG at the
  // older place, which init does not write, made every hook fall back to the template's defaults:
  // the scrub off where the repository opted in, no coupled pairs, the repository's protected
  // paths replaced. Nothing said so, because the self-test resolved the config its own way.
  const dir = tempRepo("config-wiring", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const settings = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
  const pinned = settings.env?.ADOPTION_CONFIG;
  assert.ok(
    !pinned || existsSync(join(dir, pinned)),
    `settings pins ${pinned}, which init does not write`,
  );
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.scrub = { enabled: true };
  cfg.coupled = [{ when: "src/", then: "docs/", why: "x" }];
  cfg.protectedPaths = ["sacred/"];
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const read = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {loadConfig} from './.claude/hooks/lib.mjs'; const c = loadConfig(); process.stdout.write(JSON.stringify({scrub:c.scrub?.enabled, coupled:(c.coupled||[]).length, protected:c.protectedPaths}));",
    ],
    { cwd: dir, encoding: "utf8", env: { ...process.env, ADOPTION_CONFIG: "" } },
  );
  const seen = JSON.parse(read.stdout || "{}");
  assert.equal(
    seen.scrub,
    true,
    `the hooks read the repository's scrub setting: ${read.stdout}${read.stderr}`,
  );
  assert.equal(seen.coupled, 1, "and its coupled pairs");
  assert.deepEqual(seen.protected, ["sacred/"], "and its protected paths, not the template's");
});
