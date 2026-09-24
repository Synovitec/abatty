import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, tempRepo } from "./helpers.mjs";
// Loaded by URL: the hooks are an install's code, not typechecked with this package's sources.
const HOOK = new URL("../templates/harness/hooks/check-direction.mjs", import.meta.url).href;
/** @type {(o: { base: string, config: unknown, cwd: string }) => { blocking: { file: string, detail: string }[] }} */
const checkDirection = (await import(HOOK)).checkDirection;

// An adopter enabled a probe in the root config and was told it had loosened something "under
// .claude/", with a command to restore the looser file. By day a tightening is not a loosening;
// at night the root config is read-only whatever the change.

const CONFIG = {
  baseBranch: "main",
  ratchet: { enable: ["types.nonNull"], hard: [], ratchet: [] },
};

/** @param {Record<string, unknown>} next */
function changed(next) {
  const dir = tempRepo("direction-config", {
    "abatty.config.json": JSON.stringify(CONFIG, null, 2),
  });
  git(dir, "branch", "-M", "main");
  writeFileSync(join(dir, "abatty.config.json"), JSON.stringify(next, null, 2));
  return dir;
}

const run = (/** @type {string} */ dir) => {
  const r = checkDirection({ base: "main", config: CONFIG, cwd: dir });
  return r.blocking.filter((f) => f.file === "abatty.config.json");
};

test("by day, a probe enabled or a metric made HARD is a tightening, and nothing is said", () => {
  const before = process.env.ADOPTION_RUN;
  delete process.env.ADOPTION_RUN;
  try {
    const tighter = {
      ...CONFIG,
      ratchet: {
        enable: ["types.nonNull", "test.coverageExclusions"],
        hard: ["code.clones"],
        ratchet: [],
      },
    };
    assert.deepEqual(run(changed(tighter)), []);
    const looser = {
      ...CONFIG,
      ratchet: { enable: [], hard: [], ratchet: [] },
      baseBranch: "develop",
    };
    const found = run(changed(looser));
    assert.equal(found.length, 1);
    assert.match(
      String(found[0]?.detail),
      /abatty\.config\.json changed .* beyond a tightening: ratchet\.enable lost an entry, baseBranch changed/,
    );
    assert.doesNotMatch(String(found[0]?.detail), /under \.claude/);
  } finally {
    if (before !== undefined) process.env.ADOPTION_RUN = before;
  }
});

test("at night the root config is read-only, a tightening included", () => {
  const before = process.env.ADOPTION_RUN;
  process.env.ADOPTION_RUN = "1";
  try {
    const tighter = {
      ...CONFIG,
      ratchet: { enable: ["types.nonNull", "test.coverageExclusions"], hard: [], ratchet: [] },
    };
    const found = run(changed(tighter));
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.detail), /read-only to an unattended run/);
  } finally {
    if (before === undefined) delete process.env.ADOPTION_RUN;
    else process.env.ADOPTION_RUN = before;
  }
});
