import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { RULES } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { loosenedRules, unrefusedSecrets } from "../src/core/secret-reads.mjs";

// An adopter narrowed the template's `Read(./.env.*)` to eight named files so an allow for the
// example file could work; every daytime check stayed green while `.env.staging` became readable.
// Coverage is judged by what the deny globs match, on names planted for it.

const SHIPPED = JSON.parse(
  readFileSync(new URL("../templates/harness/settings.project.json", import.meta.url), "utf8"),
);
const NARROWED = [
  "Read(./.env)",
  "Read(./.env.local)",
  "Read(./.env.development)",
  "Read(./.env.development.local)",
  "Read(./.env.production)",
  "Read(./.env.production.local)",
  "Read(./.env.test)",
  "Read(./.env.test.local)",
];
/** The template's settings with the secret denies narrowed to named files, as the adopter did. */
function narrowed() {
  const s = structuredClone(SHIPPED);
  s.permissions.deny = [
    ...NARROWED,
    ...s.permissions.deny.filter((/** @type {string} */ d) => !d.startsWith("Read(")),
  ];
  s.permissions.allow = [...(s.permissions.allow || []), "Read(./.env.example)"];
  return s;
}

test("the template refuses every env variant; a list of names leaves the others readable", () => {
  assert.deepEqual(unrefusedSecrets(SHIPPED), []);
  assert.deepEqual(unrefusedSecrets(narrowed()), [
    ".env.staging",
    ".env.prod",
    ".env.backup",
    ".env.local.bak",
    ".env.vercel",
  ]);
  assert.deepEqual(unrefusedSecrets({ permissions: { deny: ["Read(**/.env*)"] } }), []);
  // A single leading slash is the project root in the settings' syntax; only // is absolute.
  assert.deepEqual(
    unrefusedSecrets({ permissions: { deny: ["Read(/.env)", "Read(/.env.*)"] } }),
    [],
  );
  assert.equal(unrefusedSecrets({ permissions: { deny: ["Read(//etc/.env)"] } }).length, 8);
  assert.deepEqual(loosenedRules(SHIPPED, narrowed()), {
    removedDenies: ["Read(./.env.*)"],
    addedAllows: ["Read(./.env.example)"],
  });
});

test("SEC-AGENT-PERMISSIONS is partial when an env file is readable, whatever the words say", () => {
  const rule = RULES.find((r) => r.id === "SEC-AGENT-PERMISSIONS");
  assert.ok(rule);
  /** @param {any} settings */
  const judge = (settings) =>
    rule.check(
      buildContext(
        tempRepo("perm-secrets", {
          "abatty.config.json": "{}\n",
          ".claude/settings.json": JSON.stringify(settings, null, 2),
        }),
      ),
    );
  const held = judge({
    permissions: { deny: [...SHIPPED.permissions.deny, "Bash(git reset --hard *)"] },
  });
  assert.equal(held.status, "present", held.evidence);
  const loose = judge({
    permissions: { deny: [...narrowed().permissions.deny, "Bash(git reset --hard *)"] },
  });
  assert.equal(loose.status, "partial");
  assert.match(loose.evidence, /readable by the agent: \.env\.staging/);
});

test("doctor names a narrowed deny and fails on an env file the agent may read", () => {
  const dir = tempRepo("doctor-secrets", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  writeFileSync(join(dir, ".claude/settings.json"), JSON.stringify(narrowed(), null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  cli(["hooks", dir], dir);
  git(dir, "commit", "-q", "--allow-empty", "-m", "chore: the hooks executable");
  const r = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /the agent may read \.env\.staging, \.env\.prod/);
  assert.match(
    r.out,
    /deny rule\(s\) the template ships and the settings dropped: Read\(\.\/\.env\.\*\)/,
  );
  assert.match(r.out, /allow rule\(s\) the settings added: Read\(\.\/\.env\.example\)/);
  // The same repository with the wildcard back: nothing to name, and doctor is ok.
  writeFileSync(join(dir, ".claude/settings.json"), JSON.stringify(SHIPPED, null, 2) + "\n");
  const ok = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.equal(ok.code, 0, ok.out);
  assert.doesNotMatch(ok.out, /the agent may read/);
});
