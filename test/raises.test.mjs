import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
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

test("debt moved into a file, or a floor loosened through the config, is a raise too", () => {
  const withDebt = {
    ...BASE,
    debt: { "size.overBudget": { "src/a.ts": 3 } },
  };
  const cfg = {
    ratchet: {
      exclude: [],
      exempt: ["^scripts/"],
      hard: ["fn.complexity"],
      enable: ["code.clones"],
      cap: 800,
    },
  };
  const dir = tempRepo("raises-debt", {
    [REL]: JSON.stringify(withDebt),
    "abatty.config.json": JSON.stringify(cfg),
  });
  // the total holds at 3, but a file that carried none carries 1 and a.ts falls to 2
  writeFileSync(
    join(dir, REL),
    JSON.stringify({ ...withDebt, debt: { "size.overBudget": { "src/a.ts": 2, "src/b.ts": 1 } } }),
  );
  writeFileSync(
    join(dir, "abatty.config.json"),
    JSON.stringify({
      ratchet: {
        exclude: ["docs.citations"],
        exempt: ["^scripts/", "^src/legacy/"],
        hard: [],
        enable: [],
        cap: 1000,
      },
    }),
  );
  const got = floorRises(dir, "main").loosened.map(
    (l) => `${l.metric} ${l.how} ${l.path || (l.now ?? l.was)}`,
  );
  assert.deepEqual(got.sort(), [
    "ratchet.cap config 1000",
    "ratchet.enable config code.clones",
    "ratchet.exclude config docs.citations",
    "ratchet.exempt config ^src/legacy/",
    "ratchet.hard config fn.complexity",
    "size.overBudget rose in a file src/b.ts",
  ]);
  // and the same config and debt, unchanged, loosen nothing
  const same = tempRepo("raises-same", {
    [REL]: JSON.stringify(withDebt),
    "abatty.config.json": JSON.stringify(cfg),
  });
  assert.deepEqual(floorRises(same, "main").loosened, []);
});

test("where the base takes direct pushes, a raise is recorded by a decision naming the metric, and said to be only that", () => {
  const dir = tempRepo("raises-direct", {
    [REL]: JSON.stringify(BASE),
    "abatty.config.json": JSON.stringify({ directPushToBase: true }),
    "docs/ADOPTION_DECISIONS.md": "# Decisions\n",
  });
  git(dir, "checkout", "-q", "-b", "work");
  writeFileSync(
    join(dir, REL),
    JSON.stringify({ ...BASE, metrics: { ...BASE.metrics, "size.overBudget": 4 } }),
  );
  git(dir, "commit", "-qam", "chore: raise");
  const bare = cli(["raises", dir, "--base", "main"], dir);
  assert.equal(bare.code, 3, bare.out);
  assert.match(bare.out, /no decision in the range names it/);
  writeFileSync(
    join(dir, "docs/ADOPTION_DECISIONS.md"),
    "# Decisions\n\n- 2026-09-24 · size.overBudget 3 → 4 · a vendored file, split next week · owner: A. Person\n",
  );
  git(dir, "commit", "-qam", "docs: the decision");
  const recorded = cli(["raises", dir, "--base", "main"], dir);
  assert.equal(recorded.code, 0, recorded.out);
  assert.match(recorded.out, /the record is the decision, not a second person's approval/);
  // A repository that takes pull requests still needs the approval, not a line in a file.
  writeFileSync(join(dir, "abatty.config.json"), JSON.stringify({ directPushToBase: false }));
  git(dir, "commit", "-qam", "chore: pull requests");
  assert.equal(cli(["raises", dir, "--base", "main"], dir).code, 3);
});

test("a file moved since the base carries its floor, so the move loosens nothing", () => {
  const floor = (/** @type {string} */ path) =>
    JSON.stringify({
      metrics: { "size.overBudget": 1 },
      hard: [],
      debt: { "size.overBudget": { [path]: 1 } },
    });
  const dir = tempRepo("raises-renamed", {
    [REL]: floor("src/a.ts"),
    "src/a.ts": "export const a = 1;\n",
  });
  git(dir, "mv", "src/a.ts", "src/b.ts");
  writeFileSync(join(dir, REL), floor("src/b.ts"));
  assert.deepEqual(floorRises(dir, "main").loosened, []);
});
