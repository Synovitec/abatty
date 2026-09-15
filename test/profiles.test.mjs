import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { RULES, loadCatalog } from "../src/rules/index.mjs";
import {
  PROFILES,
  catalogOf,
  loadProfiles,
  phasesOf,
  profileNames,
  validateProfile,
} from "../src/profiles/index.mjs";
import { synovitec } from "../src/profiles/synovitec.mjs";

const ACME = `export const profile = {
  id: "acme",
  name: "Acme's standard",
  phases: [{ id: "0", title: "An owner" }],
  presets: [],
  rules: [
    {
      id: "ACME-OWNERS",
      family: "Ownership",
      title: "An OWNERS file names the team",
      level: "must",
      enforcement: "prose",
      phase: "0",
      why: "A repository without an owner is a repository nobody answers for; the file is the name.",
      next: "Add OWNERS at the root",
      check: (c) => ({ status: c.exists("OWNERS") ? "present" : "missing", evidence: c.exists("OWNERS") ? "OWNERS" : "none" }),
    },
  ],
};
`;

/** @param {string} name @param {unknown} profiles @param {string} [profileText] */
function repoWith(name, profiles, profileText = ACME) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  mkdirSync(join(dir, "profiles"), { recursive: true });
  writeFileSync(join(dir, "profiles", "acme.mjs"), profileText);
  writeFileSync(join(dir, "abatty.config.json"), JSON.stringify({ profiles }, null, 2) + "\n");
  return dir;
}

test("the built-in profile is the catalog: its rules are RULES, its phases the plan's, and it is well-formed", () => {
  assert.deepEqual(
    PROFILES.map((p) => p.id),
    ["synovitec"],
  );
  assert.deepEqual(validateProfile(synovitec), []);
  assert.deepEqual(
    catalogOf([synovitec]).map((r) => r.id),
    RULES.map((r) => r.id),
  );
  assert.deepEqual(
    phasesOf([synovitec]).map((p) => p.id),
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  );
  for (const r of RULES) {
    const phases = r.phase.split(/\s*\/\s*/);
    for (const ph of phases)
      if (/^\d+$/.test(ph))
        assert.ok(
          synovitec.phases.some((p) => p.id === ph),
          `${r.id}: phase ${ph} is a phase of the profile`,
        );
  }
  assert.deepEqual(profileNames({}), ["synovitec"], "the default");
  assert.deepEqual(profileNames({ profiles: "acme" }), ["acme"]);
  assert.match(
    validateProfile({ id: "Bad Id", rules: "x" }).join("; "),
    /id must be|rules must be/,
  );
});

test("a repository names its profiles: a file profile on top of the built-in one, or alone; clashes and unknown names are problems", async () => {
  const both = repoWith("profiles-both", ["synovitec", "./profiles/acme.mjs"]);
  const cat = await loadCatalog(both);
  assert.deepEqual(cat.problems, []);
  assert.deepEqual(cat.profiles, ["synovitec", "acme"]);
  assert.equal(cat.rules.length, RULES.length + 1);
  const own = cat.rules.find((r) => r.id === "ACME-OWNERS");
  assert.equal(own?.source, "profile:acme");
  const screen = cli(["rules", both], both);
  assert.match(
    screen.out,
    new RegExp(`${RULES.length + 1} of ${RULES.length + 1} · profiles synovitec, acme`),
  );
  assert.match(screen.out, /ACME-OWNERS.*profile:acme/);
  const shown = cli(["profiles", both, "--json"], both);
  const j = JSON.parse(shown.out);
  assert.deepEqual(
    j.profiles.map((/** @type {{ id: string, rules: number }} */ p) => [p.id, p.rules]),
    [
      ["synovitec", RULES.length],
      ["acme", 1],
    ],
  );

  // A client project carries only its own standard.
  const alone = repoWith("profiles-alone", ["./profiles/acme.mjs"]);
  const own2 = await loadCatalog(alone);
  assert.deepEqual(own2.profiles, ["acme"]);
  assert.equal(own2.rules.length, 1);
  const measured = cli(["measure", alone, "--json"], alone);
  const report = JSON.parse(measured.out);
  assert.deepEqual(report.profiles, ["acme"]);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].status, "missing");

  // A clash: a profile redefining a built-in rule loses it; an unknown name is a problem.
  const clash = repoWith(
    "profiles-clash",
    ["synovitec", "./profiles/acme.mjs", "nope-profile"],
    ACME.replace('id: "ACME-OWNERS"', 'id: "CODE-DUP"'),
  );
  const c = await loadProfiles(clash, {
    profiles: ["synovitec", "./profiles/acme.mjs", "nope-profile"],
  });
  assert.deepEqual(
    c.profiles.map((p) => [p.id, p.rules.length]),
    [
      ["synovitec", RULES.length],
      ["acme", 0],
    ],
  );
  assert.match(c.problems.join("\n"), /CODE-DUP is a rule of synovitec already/);
  assert.match(c.problems.join("\n"), /nope-profile is neither a built-in profile/);
  const missing = await loadProfiles(clash, { profiles: ["./profiles/none.mjs"] });
  assert.deepEqual(missing.profiles, []);
  assert.match(missing.problems.join("\n"), /not found/);
  const twice = await loadProfiles(clash, { profiles: ["synovitec", "synovitec"] });
  assert.match(twice.problems.join("\n"), /named twice/);
});
