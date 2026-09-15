import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import {
  changelogPairs,
  coupledFindings,
  normalisePairs,
  pathMatcher,
} from "../src/core/coupled.mjs";

test("the mechanism: prefixes and globs match, pairs normalise, an offender is cured by a later commit touching the counterpart", () => {
  assert.equal(pathMatcher("src/")("src/a.ts"), true);
  assert.equal(pathMatcher("docs/AUTH.md")("docs/AUTH.md"), true);
  assert.equal(
    pathMatcher("migrations/")("packages/db/migrations/0001.sql"),
    true,
    "a prefix anywhere",
  );
  assert.equal(pathMatcher("src/api/**/*.ts")("src/api/v1/users.ts"), true);
  assert.equal(pathMatcher("src/api/**/*.ts")("src/api/users.ts"), true);
  assert.equal(pathMatcher("src/api/*.ts")("src/api/v1/users.ts"), false, "one segment");
  assert.equal(pathMatcher("src/client/**")("src/client/x/y.ts"), true);
  assert.deepEqual(
    normalisePairs([{ when: "a", then: ["b", "c"], why: "w" }, { when: "x" }, null]),
    [{ when: ["a"], then: ["b", "c"], why: "w" }],
  );
  const commits = [
    { sha: "1", subject: "feat: schema", files: ["src/db/schema.ts"] },
    { sha: "2", subject: "feat: api", files: ["src/api/users.ts"] },
    { sha: "3", subject: "feat: migration", files: ["migrations/0002.sql"] },
    { sha: "4", subject: "feat: schema again", files: ["src/db/schema.ts", "src/api/x.ts"] },
  ];
  const pairs = normalisePairs([
    { when: "src/db/schema.ts", then: "migrations/", why: "a schema ships its migration" },
    { when: "src/api/", then: "src/client/" },
  ]);
  const f = coupledFindings(commits, pairs);
  assert.deepEqual(
    f.map((x) => [x.path, x.detail]),
    [
      [
        "4",
        "feat: schema again: src/db/schema.ts changed, migrations/ not touched after it (a schema ships its migration)",
      ],
      ["2", "feat: api: src/api/users.ts changed, src/client/ not touched after it"],
      ["4", "feat: schema again: src/api/x.ts changed, src/client/ not touched after it"],
    ],
  );
  assert.deepEqual(
    changelogPairs({ changelog: "CHANGELOG.md", changelogRequiredFor: ["src/"] })[0]?.then,
    ["CHANGELOG.md"],
  );
});

test("the ratchet's probe: a coupled pair broken in the pushed range is red, cured by a new commit; no pairs is skipped", () => {
  const dir = tempRepo("coupled-ratchet", {
    "package.json": NEXT_PKG,
    "src/db/schema.ts": "export {};\n",
    "migrations/0001.sql": "-- one\n",
    "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
    "abatty.config.json":
      JSON.stringify({
        coupled: [
          {
            when: "src/db/schema.ts",
            then: "migrations/",
            why: "a schema change ships its migration",
          },
        ],
      }) + "\n",
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the tree");
  writeFileSync(join(dir, "src/db/schema.ts"), "export const t = 1;\n");
  writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n- a column\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a column");
  const red = cli(["ratchet", dir, "--range", "HEAD~1..HEAD"], dir);
  assert.notEqual(red.code, 0, red.out);
  assert.match(red.out, /change\.coupledMissing/);
  assert.match(
    red.out,
    /migrations\/ not touched after it \(a schema change ships its migration\)/,
  );
  writeFileSync(join(dir, "migrations/0002.sql"), "-- two\n");
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# Changelog\n\n## [Unreleased]\n\n- a column\n- its migration\n",
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: its migration");
  const green = cli(["ratchet", dir, "--range", "HEAD~2..HEAD"], dir);
  assert.equal(green.code, 0, green.out);
  const none = tempRepo("coupled-none", { "package.json": NEXT_PKG });
  git(none, "add", "-A");
  git(none, "commit", "-q", "-m", "chore: the tree");
  const skipped = cli(["ratchet", none, "--range", "HEAD~1..HEAD", "--json"], none);
  const verdict = JSON.parse(skipped.out).verdicts?.find(
    (/** @type {{ metric: string }} */ v) => v.metric === "change.coupledMissing",
  );
  assert.equal(verdict?.status, "skipped", skipped.out.slice(0, 300));
});

test("the Stop hook refuses a night's stop while a coupled path changed without its counterpart, and lets it go once a new commit touches it", () => {
  const dir = tempRepo("coupled-stop", {
    "package.json": NEXT_PKG,
    "src/db/schema.ts": "export {};\n",
    "migrations/0001.sql": "-- one\n",
  });
  cli(["init", dir, "--stack", "next"], dir);
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts["gate:fast"] = 'node -e "process.exit(0)"';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.commands.gate = "npm run gate:fast";
  cfg.coupled = [
    { when: "src/db/schema.ts", then: "migrations/", why: "a schema change ships its migration" },
  ];
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  git(dir, "checkout", "-q", "-b", "adopt/standards-test");
  writeFileSync(join(dir, "src/db/schema.ts"), "export const t = 1;\n");
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    readFileSync(join(dir, "CHANGELOG.md"), "utf8") + "\n- a column\n",
  );
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: a column");
  const stop = () =>
    spawnSync(process.execPath, [join(dir, ".claude/hooks/stop-gate.mjs")], {
      cwd: dir,
      input: JSON.stringify({ session_id: "coupled-test", hook_event_name: "Stop" }),
      encoding: "utf8",
      env: {
        ...process.env,
        ADOPTION_RUN: "1",
        ADOPTION_BASE: "main",
        ADOPTION_BRANCH: "adopt/standards-test",
        ABATTY_AGENT: STUB_AGENT,
      },
    });
  const blocked = stop();
  assert.equal(blocked.status, 2, blocked.stdout + blocked.stderr);
  assert.match(blocked.stderr, /coupled path\(s\) changed without their counterpart/);
  assert.match(blocked.stderr, /src\/db\/schema\.ts changed, migrations\/ not touched after it/);
  writeFileSync(join(dir, "migrations/0002.sql"), "-- two\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: its migration");
  const allowed = stop();
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
});
