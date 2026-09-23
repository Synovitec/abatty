import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";
import { floorRises, reviewApproval } from "../src/core/raises.mjs";

const REL = "scripts/ci/standards-baseline.json";
const BASE = {
  metrics: { "size.overBudget": 3, "fn.complexity": 0, "docs.stale": 2 },
  hard: ["fn.complexity"],
};

/** A repository whose main carries BASE, with the working copy's baseline replaced. @param {string} name @param {object} now */
function raised(name, now) {
  const dir = tempRepo(name, { [REL]: JSON.stringify(BASE) });
  writeFileSync(join(dir, REL), JSON.stringify(now));
  return dir;
}

test("a floor that rose, one that vanished and a HARD one demoted are each named against the base", () => {
  const dir = raised("raises-loosened", {
    metrics: { "size.overBudget": 5, "fn.complexity": 0 },
    hard: [],
  });
  const r = floorRises(dir, "main");
  assert.equal(r.found, true);
  assert.deepEqual(
    r.loosened.map((l) => `${l.metric} ${l.how}`),
    ["docs.stale vanished", "fn.complexity no longer hard", "size.overBudget rose"],
  );
});

test("a floor that fell or stayed loosens nothing, and a base without a baseline has no floor to raise", () => {
  const fell = raised("raises-fell", {
    metrics: { "size.overBudget": 1, "fn.complexity": 0, "docs.stale": 2 },
    hard: ["fn.complexity"],
  });
  assert.deepEqual(floorRises(fell, "main").loosened, []);
  const none = tempRepo("raises-none");
  assert.equal(floorRises(none, "main").found, false);
});

test("the command fails a loosened floor with no approval to read, and passes an untouched one", () => {
  const dir = raised("raises-cli", {
    metrics: { ...BASE.metrics, "size.overBudget": 4 },
    hard: BASE.hard,
  });
  const red = cli(["raises", dir, "--base", "main"], dir);
  assert.equal(red.code, 3, red.out);
  assert.match(red.out, /size\.overBudget\s+rose · 3 → 4/);
  writeFileSync(join(dir, REL), JSON.stringify(BASE));
  assert.equal(cli(["raises", dir, "--base", "main"], dir).code, 0);
});

const HEAD = "abc123";
/** @param {object[]} reviews @param {boolean} [ok] */
const forge =
  (reviews, ok = true) =>
  () => ({
    ok,
    stdout: JSON.stringify({ author: { login: "raiser" }, headRefOid: HEAD, reviews }),
  });
/** @param {string} login @param {string} state @param {string} at @param {string} [oid] */
const review = (login, state, at, oid = HEAD) => ({
  author: { login },
  state,
  submittedAt: at,
  commit: { oid },
});

test("only an approval of the head commit by somebody other than the author lands a raise", () => {
  assert.equal(
    reviewApproval("7", forge([review("lead", "APPROVED", "2026-09-23T10:00:00Z")])).approved,
    true,
  );
  assert.equal(
    reviewApproval("7", forge([review("raiser", "APPROVED", "2026-09-23T10:00:00Z")])).approved,
    false,
    "the author",
  );
  assert.equal(
    reviewApproval("7", forge([review("lead", "APPROVED", "2026-09-23T10:00:00Z", "old")]))
      .approved,
    false,
    "an older commit",
  );
  const changed = forge([
    review("lead", "APPROVED", "2026-09-23T10:00:00Z"),
    review("lead", "CHANGES_REQUESTED", "2026-09-23T11:00:00Z"),
    review("lead", "COMMENTED", "2026-09-23T12:00:00Z"),
  ]);
  assert.equal(
    reviewApproval("7", changed).approved,
    false,
    "the reviewer's latest verdict counts, a comment is not one",
  );
  const commented = forge([
    review("lead", "APPROVED", "2026-09-23T10:00:00Z"),
    review("lead", "COMMENTED", "2026-09-23T12:00:00Z"),
  ]);
  assert.equal(reviewApproval("7", commented).approved, true, "a comment after an approval");
  assert.equal(reviewApproval("7", forge([], false)).approved, false, "the forge unreachable");
  assert.equal(reviewApproval("7", () => ({ ok: true, stdout: "not json" })).approved, false);
});
