import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hookModes } from "../src/core/hook-modes.mjs";

// Every case reads a home of its own, so the machine's own settings never decide an answer.

/** @param {Record<string, unknown>} files @returns {{ dir: string, home: string }} */
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "abatty-hooks-"));
  const home = mkdtempSync(join(tmpdir(), "abatty-home-"));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(rel.startsWith("~/") ? home : dir, rel.replace(/^~\//, ""));
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body));
  }
  return { dir, home };
}

const hook = (/** @type {string} */ name, /** @type {string} */ event, matcher = "") => ({
  [event]: [
    {
      ...(matcher && { matcher }),
      hooks: [{ type: "command", command: "node", args: [`.claude/hooks/${name}.mjs`] }],
    },
  ],
});

const WIRED = {
  hooks: {
    ...hook("guard", "PreToolUse", "Bash"),
    ...hook("lint-on-edit", "PostToolUse", "Edit"),
    ...hook("stop-gate", "Stop"),
  },
};

test("a hook the settings wire reads as the config narrows it; one they do not is named as never running", () => {
  const { dir, home } = repo({
    ".claude/settings.json": WIRED,
    "abatty.config.json": { baseBranch: "trunk", directPushToBase: true, lintOnEdit: false },
  });
  const modes = Object.fromEntries(hookModes(dir, { home }).map((m) => [m.hook, m]));
  assert.deepEqual(modes.guard?.wired, ["PreToolUse(Bash)"]);
  assert.match(modes.guard?.day || "", /push to trunk allowed/);
  assert.equal(modes.guard?.warn, undefined);
  assert.match(modes["lint-on-edit"]?.night || "", /off \(lintOnEdit: false\)/);
  assert.equal(modes["lint-on-edit"]?.warn, undefined, "switched off on purpose is not a warning");
  assert.deepEqual(modes.protect?.wired, []);
  assert.match(modes.protect?.warn || "", /not wired/);
  assert.equal(modes.protect?.night, "nothing");
});

test("disableAllHooks anywhere a session reads it turns every hook off, the user's own settings included", () => {
  for (const where of [".claude/settings.local.json", "~/.claude/settings.json"]) {
    const { dir, home } = repo({
      ".claude/settings.json": WIRED,
      [where]: { disableAllHooks: true },
    });
    const guard = hookModes(dir, { home }).find((m) => m.hook === "guard");
    assert.match(guard?.warn || "", /disableAllHooks/, where);
    assert.equal(guard?.day, "nothing", where);
  }
});

test("lint on edit with a linter this machine cannot find is named; one in node_modules/.bin is not", () => {
  const cfg = {
    lintOnEdit: true,
    commands: { lintFile: "npx abatty-no-such-linter --max-warnings=0" },
  };
  const absent = repo({ ".claude/settings.json": WIRED, "abatty.config.json": cfg });
  const lint = hookModes(absent.dir, { home: absent.home }).find((m) => m.hook === "lint-on-edit");
  assert.match(lint?.warn || "", /abatty-no-such-linter is not installed/);
  const present = repo({
    ".claude/settings.json": WIRED,
    "abatty.config.json": cfg,
    "node_modules/.bin/abatty-no-such-linter": "",
  });
  const found = hookModes(present.dir, { home: present.home }).find(
    (m) => m.hook === "lint-on-edit",
  );
  assert.equal(found?.warn, undefined);
});
