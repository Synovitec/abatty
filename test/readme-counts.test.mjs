import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileById } from "../src/profiles/index.mjs";

// The README says how many rules each profile has and how each is held. An outside review asked
// for that split ("80 rules" read as 80 automated checks); written by hand, it would drift the
// first time a rule moved up a level. It is held equal to the catalog here.

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\s+/g, " ");

/** @param {string} id */
function counts(id) {
  const rules = profileById(id)?.rules || [];
  const n = (/** @type {string} */ e) => rules.filter((r) => r.enforcement === e).length;
  return {
    total: rules.length,
    hard: n("hard"),
    ratchet: n("ratchet"),
    review: n("review"),
    prose: n("prose"),
  };
}

test("the README's rule counts are the catalog's", () => {
  const m = counts("minimal");
  assert.equal(m.hard, m.total, "every minimal rule is held by a machine, as the README says");
  assert.ok(
    README.includes(
      `profile: ${m.total} rules any stack agrees to, all ${m.total} held by a machine`,
    ),
    `README: minimal has ${m.total}`,
  );
  const s = counts("synovitec");
  const said = `The full catalog of ${s.total} is one team's standard (\`synovitec\`), a profile you add when you want it: ${s.hard} of its rules are held by a check that fails, ${s.ratchet} by a ratchet, ${s.review} by a review and ${s.prose} are prose only`;
  assert.ok(README.includes(said), `README should say: ${said}`);
});
