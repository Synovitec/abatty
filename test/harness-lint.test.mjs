import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { harnessLintHint } from "../src/core/harness-lint.mjs";

// An adopter's `eslint .` judged the harness init installs under .claude/ by the product's rules,
// and the gate went red on files nobody there wrote. Their config is code and is never edited:
// the line to add is said, by init and by doctor, until the config names .claude.

const FLAT = 'export default [{ rules: { "max-lines": ["error", 600] } }];\n';
/** The harness's scripts, which is what an eslint config would lint. */
const HOOK = { ".claude/hooks/guard.mjs": "export {};\n" };

test("a flat config that does not name .claude is told the ignores line", () => {
  const dir = tempRepo("hl-flat", { ...HOOK, "eslint.config.mjs": FLAT });
  assert.deepEqual(harnessLintHint(dir), {
    config: "eslint.config.mjs",
    line: '{ ignores: [".claude/**"] }',
    folders: [".claude"],
  });
});

test("the installed copies under .abatty/ are named too, and left alone once the config names them", () => {
  // A flat config does not read .gitignore: an adopter's lint counted sixty errors in the
  // template copies update keeps under .abatty/harness/.
  const copies = { ".abatty/harness/0.8.0/hooks/guard.mjs": "export {};\n" };
  const dir = tempRepo("hl-copies", { ...HOOK, ...copies, "eslint.config.mjs": FLAT });
  assert.equal(harnessLintHint(dir)?.line, '{ ignores: [".claude/**", ".abatty/**"] }');
  const half = tempRepo("hl-half", {
    ...HOOK,
    ...copies,
    "eslint.config.mjs": 'export default [{ ignores: [".claude/**"] }];\n',
  });
  assert.equal(harnessLintHint(half)?.line, '{ ignores: [".abatty/**"] }');
});

test("a legacy config is told its own key", () => {
  const dir = tempRepo("hl-legacy", { ...HOOK, ".eslintrc.json": "{}\n" });
  assert.equal(harnessLintHint(dir)?.line, 'ignorePatterns: [".claude/"]');
});

test("with no harness installed (the minimal profile) there is nothing to ignore, and nothing is said", () => {
  const dir = tempRepo("hl-minimal", {
    "eslint.config.mjs": FLAT,
    ".claude/harness.lock.json": "{}\n",
  });
  assert.equal(harnessLintHint(dir), null);
});

test("a config or an .eslintignore that names .claude, or no eslint at all, is left alone", () => {
  const named = tempRepo("hl-named", {
    "eslint.config.js": 'export default [{ ignores: [".claude/**"] }];\n',
  });
  assert.equal(harnessLintHint(named), null);
  const ignored = tempRepo("hl-ignore", {
    ".eslintrc.cjs": "module.exports = {};\n",
    ".eslintignore": ".claude/\n",
  });
  assert.equal(harnessLintHint(ignored), null);
  assert.equal(harnessLintHint(tempRepo("hl-none", { "package.json": "{}" })), null);
});

test("init lists it among the steps by hand, and doctor says it without failing", () => {
  const dir = tempRepo("hl-cli", { "package.json": NEXT_PKG, "eslint.config.mjs": FLAT });
  const init = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.match(
    init.out,
    /\d+\. eslint\.config\.mjs lints \.claude\/ and \.abatty\/, the harness abatty installs/,
  );
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(
    doc.out,
    /eslint\.config\.mjs lints \.claude\/.*abatty does not edit your eslint config/,
  );
});
