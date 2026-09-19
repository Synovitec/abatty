import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, tempRepo } from "./helpers.mjs";
import {
  BYTES_PER_TOKEN,
  describeFootprint,
  footprintShare,
  harnessFootprint,
} from "../src/night/footprint.mjs";

/** A repository carrying a harness of a known size. @param {number} contextBytes */
function harnessed(contextBytes) {
  const dir = tempRepo("footprint-" + contextBytes, { "package.json": NEXT_PKG });
  writeFileSync(join(dir, "CLAUDE.md"), "x".repeat(contextBytes));
  mkdirSync(join(dir, ".claude/rules"), { recursive: true });
  writeFileSync(join(dir, ".claude/rules/testing.md"), "y".repeat(400));
  mkdirSync(join(dir, ".claude/agents"), { recursive: true });
  writeFileSync(join(dir, ".claude/agents/reviewer.md"), "z".repeat(200));
  return dir;
}

test("the harness footprint counts what a session reads before it reads any code, by part", () => {
  const f = harnessFootprint(harnessed(2000));
  assert.equal(f.bytes, 2600);
  assert.equal(f.tokens, Math.round(2600 / BYTES_PER_TOKEN));
  assert.deepEqual(
    f.parts.map((p) => [p.part, p.bytes]),
    [
      ["context file", 2000],
      ["rules", 400],
      ["agents", 200],
    ],
  );
  // a part that is not there is not a zero row: an empty line in a table reads as measured
  assert.equal(
    f.parts.some((p) => p.part === "skills"),
    false,
  );
});

test("the number says it is an estimate, in the object rather than in a comment", () => {
  const f = harnessFootprint(harnessed(1000));
  assert.equal(f.estimated, true, "a caller must not be able to print it as a measurement");
  assert.equal(f.bytesPerToken, BYTES_PER_TOKEN);
  assert.match(describeFootprint(f), /estimated at 4 bytes per token/);
  assert.match(describeFootprint(f), /the bytes are exact, the tokens are not/);
});

test("the share is what the night carried, and it is null rather than zero when nothing was spent", () => {
  const f = harnessFootprint(harnessed(4000));
  const s = footprintShare(f, { sessions: 5, tokens: 100000 });
  assert.equal(s.perSession, f.tokens);
  assert.equal(s.carried, f.tokens * 5);
  assert.equal(s.share, Math.round((100 * f.tokens * 5) / 100000));
  assert.match(describeFootprint(f, s), /Over 5 session\(s\)/);

  // a night that reported no tokens cannot have a share, and zero would read as "it cost nothing"
  assert.equal(footprintShare(f, { sessions: 3, tokens: 0 }).share, null);
  // and with no sessions there is nothing to say beyond the per-session figure
  assert.equal(
    describeFootprint(f, footprintShare(f, { sessions: 0, tokens: 0 })).includes("Over"),
    false,
  );
});

test("a repository with no harness has a footprint of nothing, not a crash", () => {
  const dir = tempRepo("footprint-bare", { "package.json": NEXT_PKG });
  const f = harnessFootprint(dir);
  assert.equal(f.bytes, 0);
  assert.equal(f.tokens, 0);
  assert.deepEqual(f.parts, []);
});
