import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { surface } from "./contract/surface.mjs";

// Below 1.0 a minor release is anything that can turn an adopter's green run red or change what a
// machine reads (docs/VERSIONING.md). The surfaces are held equal to a committed snapshot, so each
// change to them is made on purpose, named in the changelog's Upgrading section, and reviewed as
// a diff of one file. When the snapshot stops changing, the contract is ready to be promised: 1.0.
//
//   UPDATE_CONTRACT=1 node --test test/contract-surface.test.mjs    rewrite it, then read the diff

const SNAPSHOT = fileURLToPath(new URL("./contract/surface.json", import.meta.url));

test("the machine surfaces are the committed contract, or the change to them is deliberate", async () => {
  const now = await surface();
  if (process.env.UPDATE_CONTRACT === "1") {
    writeFileSync(SNAPSHOT, JSON.stringify(now, null, 2) + "\n");
    return;
  }
  // A missing snapshot is a contract gone, not one to write afresh and call green.
  assert.ok(existsSync(SNAPSHOT), "test/contract/surface.json is missing: restore it from git");
  const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  for (const key of Object.keys({ ...committed, ...now }))
    assert.deepEqual(
      now[/** @type {keyof typeof now} */ (key)],
      committed[key],
      `the ${key} surface changed. If it is meant to, this is a minor release: name the change under Upgrading in CHANGELOG.md, then UPDATE_CONTRACT=1 node --test test/contract-surface.test.mjs and commit the snapshot`,
    );
});
