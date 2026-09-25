import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { migrateRedefined } from "../src/ratchet/migrate.mjs";

// A redefined probe read its old floor as `redefined` until every adopter ran `abatty baseline` by
// hand, which each release note asked of them. `update` rewrites those floors itself, only those.

const REL = "scripts/ci/standards-baseline.json";
const LONG = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const read = (/** @type {string} */ dir) => JSON.parse(readFileSync(join(dir, REL), "utf8"));

/** A repository whose baseline holds size.excessCode under a definition the probe no longer has. */
function redefinedFloor() {
  const dir = tempRepo("migrate", {
    "package.json": JSON.stringify({ name: "m" }),
    "src/a.ts": LONG(400),
  });
  assert.equal(cli(["baseline", dir], dir).code, 0);
  const b = read(dir);
  b.versions = { ...(b.versions || {}), "size.excessCode": 99 };
  b.metrics["size.excessCode"] = 7;
  b.metrics["size.overBudget"] = 5;
  writeFileSync(join(dir, REL), JSON.stringify(b, null, 2));
  return dir;
}

test("a floor under an old definition is rewritten under the new one, and no other floor moves", async () => {
  const dir = redefinedFloor();
  const migrated = await migrateRedefined(dir);
  assert.deepEqual(
    migrated.map((m) => [m.metric, m.was, m.now, m.written]),
    [["size.excessCode", 7, 100, true]],
  );
  const b = read(dir);
  assert.equal(b.metrics["size.excessCode"], 100);
  assert.equal(b.versions["size.excessCode"], 1);
  assert.equal(
    b.metrics["size.overBudget"],
    5,
    "a measured floor that was not redefined is left as it was",
  );
  assert.deepEqual(await migrateRedefined(dir), [], "nothing left to migrate");
});

test("a dry run writes nothing", async () => {
  const dir = redefinedFloor();
  const before = readFileSync(join(dir, REL), "utf8");
  assert.equal((await migrateRedefined(dir, { dryRun: true })).length, 1);
  assert.equal(readFileSync(join(dir, REL), "utf8"), before);
});

test("a HARD metric that now counts above zero is named and left for a person, never written", async () => {
  const dir = redefinedFloor();
  const b = read(dir);
  b.hard = [...(b.hard || []), "size.excessCode"];
  writeFileSync(join(dir, REL), JSON.stringify(b, null, 2));
  const [m] = await migrateRedefined(dir);
  assert.equal(m?.metric, "size.excessCode");
  assert.equal(m?.written, false);
  assert.match(String(m?.why), /HARD and above zero/);
  assert.equal(read(dir).metrics["size.excessCode"], 7, "the floor is as it was");
});

test("update says the gate is red and exits with findings when a HARD check it could not migrate reads above zero", () => {
  const migrated = redefinedFloor();
  const ok = cli(["update", migrated, "--dry-run"], migrated);
  assert.equal(ok.code, 0, ok.out);
  assert.doesNotMatch(ok.out, /the gate is red/);
  const dir = redefinedFloor();
  const b = read(dir);
  b.hard = [...(b.hard || []), "size.excessCode"];
  writeFileSync(join(dir, REL), JSON.stringify(b, null, 2));
  const red = cli(["update", dir, "--dry-run"], dir);
  assert.equal(red.code, 3, red.out);
  // And the ratchet names the findings where it names the verdict, not only in --json.
  const ratchet = cli(["ratchet", dir], dir);
  assert.match(ratchet.out, /REDEFINED[\s\S]*src\/a\.ts/);
  assert.match(
    red.out,
    /the gate is red from here: size\.excessCode redefined, HARD and above zero/,
  );
});
