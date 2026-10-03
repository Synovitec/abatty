import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

// A replay read the catalog the way the standard names things: `explain TEST.4` and
// `rules --family TEST` both found nothing, and `rules --plain` put [ok] beside every must.

test("explain takes the standard's section and names the rule, or the rules, that carry it", () => {
  const dir = tempRepo("explain-section", { "package.json": NEXT_PKG });
  const one = cli(["explain", "TEST.4", dir], dir);
  assert.equal(one.code, 0, one.out);
  assert.match(one.out, /TEST-COVERAGE/);
  const several = cli(["explain", "CODE.1", dir], dir);
  assert.equal(several.code, 2);
  assert.match(several.out, /CODE\.1 is the standard's section; its rules are .*CODE-SHAPE/);
});

test("a family is found by its name or its rules' prefix, and an unknown one lists the families", () => {
  const dir = tempRepo("rules-family", { "package.json": NEXT_PKG });
  const byPrefix = cli(["rules", dir, "--family", "TEST", "--json"], dir);
  const byName = cli(["rules", dir, "--family", "Tests", "--json"], dir);
  assert.ok(JSON.parse(byPrefix.out).length > 0);
  assert.deepEqual(JSON.parse(byPrefix.out), JSON.parse(byName.out));
  const nope = cli(["rules", dir, "--family", "nope"], dir);
  assert.equal(nope.code, 2);
  assert.match(nope.out, /the families are Documents, /);
});

test("the catalog marks no rule as passing: it says what must hold, not what holds here", () => {
  const dir = tempRepo("rules-marks", { "package.json": NEXT_PKG });
  const out = cli(["rules", dir, "--plain"], dir).out;
  assert.match(out, /TEST-UNIT\s+must/);
  assert.doesNotMatch(out, /\[ok\]|\[!\]/);
});
