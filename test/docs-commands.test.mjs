import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// docs/COMMANDS.md said "every command" and left out eight the CLI has, found by a review the
// night it was written. The page is held to the command list of the contract snapshot, which
// the contract test holds to the CLI.

const read = (/** @type {string} */ rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("docs/COMMANDS.md has a row for every command the CLI knows", () => {
  const doc = read("../docs/COMMANDS.md");
  const commands = /** @type {string[]} */ (JSON.parse(read("./contract/surface.json")).commands);
  // The help and version flags are not commands a reader looks up.
  const missing = commands
    .filter((c) => !/^-|^version$/.test(c))
    .filter((c) => !doc.includes(`| \`abatty ${c}`));
  assert.deepEqual(missing, []);
});
