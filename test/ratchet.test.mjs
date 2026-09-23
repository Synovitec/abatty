import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";
import {
  BUILTIN_PROBES,
  DEFAULT_CONFIG,
  compare,
  failed,
  loadProbes,
  measureAll,
  readBaseline,
  splitByRange,
  validateProbe,
  writeBaseline,
} from "../src/ratchet/index.mjs";
import { removeFixture, runControls } from "../src/ratchet/controls.mjs";
import { frontMatter } from "../src/ratchet/probes/lib.mjs";
import { buildContext } from "../src/rules/context.mjs";

/** A file of n export lines. @param {number} n */
const LONG = (n) =>
  Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const PKG = JSON.stringify({ name: "fixture", version: "0.1.0", scripts: {} }) + "\n";

// P.1: a probe with no failing control case is not added. Every built-in probe proves itself
// in both directions on a throwaway repository, here, on every push.
for (const probe of BUILTIN_PROBES) {
  test(`probe ${probe.metric}: every control holds, both directions`, () => {
    assert.ok(
      probe.controls.some((c) => c.expect > 0),
      "a control the probe must report",
    );
    assert.ok(
      probe.controls.some((c) => c.expect === 0),
      "a control the probe must not report",
    );
    for (const r of runControls(probe))
      assert.ok(
        r.ok,
        `${probe.metric} · ${r.name}: expected ${r.expect}, got ${r.got} (${r.detail})`,
      );
  });
}

/** Measure a repository with the default config and no range. @param {string} dir @param {import("../src/ratchet/index.mjs").Baseline | null} baseline */
function measure(dir, baseline, config = DEFAULT_CONFIG) {
  return measureAll(BUILTIN_PROBES, buildContext(dir), { config, range: "" }, baseline);
}

test("the three-step control: a clean tree holds; a violation fails; raising the total to match still fails and names the file", () => {
  const dir = tempRepo("ratchet3", {
    "package.json": PKG,
    "src/a.ts": LONG(310),
    "src/b.ts": LONG(10),
  });
  const config = DEFAULT_CONFIG;
  // 1. baseline the existing debt (a.ts is 10 over), then a clean run holds
  const first = writeBaseline({
    repoDir: dir,
    rel: "scripts/ci/standards-baseline.json",
    measurements: measure(dir, null),
    config,
    previous: null,
    today: "2026-09-15",
  });
  assert.equal(first.ok, true, first.refusals.join("; "));
  const baseline = readBaseline(dir, "scripts/ci/standards-baseline.json");
  assert.ok(baseline);
  assert.equal(baseline.metrics["size.overBudget"], 1);
  assert.equal(baseline.debt["size.overBudget"]?.["src/a.ts"], 1);
  assert.ok(baseline.hard?.includes("types.escapes"), "a metric at zero is promoted to HARD");
  const clean = compare(measure(dir, baseline), baseline, config);
  assert.equal(failed(clean), false, JSON.stringify(clean.filter((v) => v.status !== "ok")));
  // 2. a new violation in another file fails, naming the file
  writeFileSync(join(dir, "src/b.ts"), LONG(320));
  const worse = compare(measure(dir, baseline), baseline, config);
  const over = worse.find((v) => v.metric === "size.overBudget");
  assert.equal(over?.status, "regressed");
  assert.match(over?.messages.join("\n") || "", /src\/b\.ts 0 → 1/);
  // 3. the totals raised to match: the per-file floor still refuses it and names b.ts
  const raised = {
    ...baseline,
    metrics: { ...baseline.metrics, "size.overBudget": 2, "size.excessCode": 999 },
  };
  const still = compare(measure(dir, raised), raised, config);
  const overStill = still.find((v) => v.metric === "size.overBudget");
  assert.equal(overStill?.status, "regressed");
  assert.match(overStill?.messages.join("\n") || "", /within the floor 2, but a file worsened/);
  assert.match(overStill?.messages.join("\n") || "", /per file: src\/b\.ts/);
  // relocation: a.ts cleaned and b.ts made worse, same total, still refused
  writeFileSync(join(dir, "src/a.ts"), LONG(10));
  const moved = compare(measure(dir, baseline), baseline, config);
  assert.equal(moved.find((v) => v.metric === "size.overBudget")?.status, "regressed");
});

test("a HARD metric above zero fails; a metric without a floor fails above zero and holds at zero", () => {
  const dir = tempRepo("ratchet-hard", {
    "package.json": PKG,
    "scripts/huge.mjs": LONG(900),
    "src/ok.ts": LONG(5),
  });
  const v = compare(measure(dir, null), null, DEFAULT_CONFIG);
  assert.equal(v.find((x) => x.metric === "size.overRaw")?.status, "hard-fail");
  assert.equal(v.find((x) => x.metric === "size.overBudget")?.status, "ok");
  writeFileSync(join(dir, "src/ok.ts"), LONG(320));
  const w = compare(measure(dir, null), null, DEFAULT_CONFIG);
  assert.equal(w.find((x) => x.metric === "size.overBudget")?.status, "unbaselined");
});

test("scanned zero fails once the baseline has seen files: a moved folder never reports green forever", () => {
  const dir = tempRepo("ratchet-zero", {
    "package.json": PKG,
    "docs/README.md": '---\ntitle: "I"\ndescription: "D"\nstatus: living\n---\n',
    "src/a.ts": LONG(5),
  });
  const config = DEFAULT_CONFIG;
  const b = writeBaseline({
    repoDir: dir,
    rel: "b.json",
    measurements: measure(dir, null),
    config,
    previous: null,
    today: "2026-09-15",
  });
  assert.equal(b.baseline.scanned?.["docs.frontMatter"], 1);
  git(dir, "mv", "docs", "documentation");
  const v = compare(measure(dir, b.baseline), b.baseline, config);
  assert.equal(v.find((x) => x.metric === "docs.frontMatter")?.status, "scanned-zero");
  // the changelog probe reads commits, and an empty push is not a moved path
  assert.equal(v.find((x) => x.metric === "change.changelogMissing")?.status, "skipped");
});

test("the baseline writer refuses a rise without a reason, a HARD metric above zero, and records the reason when given", () => {
  const dir = tempRepo("ratchet-write", { "package.json": PKG, "src/a.ts": LONG(310) });
  const config = DEFAULT_CONFIG;
  const rel = "scripts/ci/standards-baseline.json";
  const first = writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, null),
    config,
    previous: null,
    today: "2026-09-15",
  });
  assert.equal(first.ok, true);
  writeFileSync(join(dir, "src/b.ts"), LONG(310));
  const prev = readBaseline(dir, rel);
  const refused = writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, prev),
    config,
    previous: prev,
    today: "2026-09-16",
  });
  assert.equal(refused.ok, false);
  assert.match(
    refused.refusals.join("\n"),
    /a floor never rises without a reason and an owner: size\.overBudget 1 → 2/,
  );
  assert.equal(readBaseline(dir, rel)?.measuredAt, "2026-09-15", "nothing written when refused");
  const allowed = writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, prev),
    config,
    previous: prev,
    today: "2026-09-16",
    reason: "the split of a.ts is phase 8",
  });
  assert.equal(allowed.ok, false, "a reason without an owner is still a floor nobody signed");
  const signed = writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, prev),
    config,
    previous: prev,
    today: "2026-09-16",
    reason: "the split of a.ts is phase 8",
    owner: "the platform team",
  });
  assert.equal(signed.ok, true);
  assert.equal(readBaseline(dir, rel)?.metrics["size.overBudget"], 2);
  const entry = readBaseline(dir, rel)?.entries?.["size.overBudget"];
  assert.deepEqual(entry, {
    at: "2026-09-16",
    was: 1,
    now: 2,
    reason: "the split of a.ts is phase 8",
    owner: "the platform team",
  });
  assert.equal(
    /** @type {any} */ (readBaseline(dir, rel))?.lastReason,
    undefined,
    "the one-per-write field is gone, not left to be read as this metric's reason",
  );
  // a HARD metric (promoted at zero) that now reads above zero is refused, not recorded
  writeFileSync(join(dir, "src/c.ts"), "export const x: any = 1;\n");
  const hard = writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, readBaseline(dir, rel)),
    config,
    previous: readBaseline(dir, rel),
    today: "2026-09-17",
  });
  assert.equal(hard.ok, false);
  assert.match(hard.refusals.join("\n"), /types\.escapes is HARD and reads 1/);
});

test("a repository's own probes load from abatty.probes.mjs, validated; a built-in name and a probe without a failing control are refused", async () => {
  const dir = tempRepo("ratchet-local", {
    "package.json": PKG,
    OWNERS: "",
    "abatty.probes.mjs": `export const probes = [
  { metric: "own.ownersEmpty", kind: "hard", standard: [], title: "OWNERS is not empty", why: "A repository without an owner is a repository nobody answers for.",
    scan: (c) => ({ scanned: c.exists("OWNERS") ? 1 : 0, findings: c.exists("OWNERS") && !c.read("OWNERS").trim() ? [{ path: "OWNERS", detail: "empty" }] : [] }),
    controls: [ { name: "empty", files: { OWNERS: "" }, expect: 1 }, { name: "named", files: { OWNERS: "team\\n" }, expect: 0 } ] },
  { metric: "size.overBudget", kind: "hard", standard: [], title: "x", why: "y", scan: () => ({ scanned: 1, findings: [] }), controls: [{ name: "a", expect: 1 }, { name: "b", expect: 0 }] },
  { metric: "own.noControl", kind: "hard", standard: [], title: "x", why: "y", scan: () => ({ scanned: 1, findings: [] }), controls: [{ name: "b", expect: 0 }] },
];
`,
  });
  const { probes, problems } = await loadProbes(dir, DEFAULT_CONFIG);
  assert.ok(probes.some((p) => p.metric === "own.ownersEmpty"));
  assert.equal(probes.filter((p) => p.metric === "size.overBudget").length, 1);
  assert.match(problems.join("\n"), /size\.overBudget: a built-in metric name/);
  assert.match(problems.join("\n"), /own\.noControl: no failing control case/);
  const own = probes.find((p) => p.metric === "own.ownersEmpty");
  assert.ok(own);
  assert.ok(runControls(own).every((r) => r.ok));
  const v = compare(
    measureAll(probes, buildContext(dir), { config: DEFAULT_CONFIG, range: "" }, null),
    null,
    DEFAULT_CONFIG,
  );
  assert.equal(v.find((x) => x.metric === "own.ownersEmpty")?.status, "hard-fail");
  assert.equal(validateProbe({ metric: "Bad", kind: "soft" }, new Set()).length > 2, true);
});

// The teardown, in both directions: a fixture that can go does, and one that cannot is not a
// verdict. The release of 0.3.0 went red on the second: git's background `gc --auto` recreated
// a file under `.git/` while the removal walked that very directory, and the throw out of the
// `finally` turned fifteen passing controls into a failed suite.
test("the control fixture is removed, and a removal that throws is not a verdict", () => {
  const dir = tempRepo("fixture-teardown", { "src/a.mjs": "export const a = 1;\n" });
  assert.ok(existsSync(join(dir, ".git", "info")));
  removeFixture(dir);
  assert.equal(existsSync(dir), false, "a fixture that can go, goes");

  // A path the platform refuses before it touches the filesystem: the throw is swallowed, and
  // a caller in a `finally` keeps whatever it was returning.
  assert.doesNotThrow(() => removeFixture("a\0path no platform accepts"));
});

test("the CLI: ratchet is red without a floor, baseline writes it, ratchet is green, --json carries the verdicts, --controls runs the cases", () => {
  const dir = tempRepo("ratchet-cli", {
    "package.json": PKG,
    "src/a.ts": LONG(310),
    "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
  });
  const red = cli(["ratchet", dir], dir);
  assert.equal(red.code, 3, red.out);
  assert.match(red.out, /NO FLOOR/);
  assert.match(red.out, /ratchet red/);
  const base = cli(["baseline", dir], dir);
  assert.equal(base.code, 0, base.out);
  assert.match(base.out, /baseline written/);
  assert.match(base.out, /promoted to HARD/);
  assert.ok(
    readFileSync(join(dir, "scripts/ci/standards-baseline.json"), "utf8").includes(
      '"size.overBudget": 1',
    ),
  );
  const green = cli(["ratchet", dir], dir);
  assert.equal(green.code, 0, green.out);
  assert.match(green.out, /ratchet green/);
  assert.match(green.out, /readability \d+\/100/);
  const json = JSON.parse(cli(["ratchet", dir, "--json"], dir).out);
  assert.equal(
    json.verdicts.find((/** @type {any} */ v) => v.metric === "size.overBudget").status,
    "ok",
  );
  const controls = cli(["ratchet", dir, "--controls"], dir);
  assert.equal(controls.code, 0, controls.out);
  assert.match(controls.out, /every control holds, both directions/);
});

test("the changelog range: a source commit after the last changelog touch fails the ratchet with --range, and the gate passes the push range", () => {
  const dir = tempRepo("ratchet-range", {
    "package.json": PKG,
    "src/a.ts": LONG(5),
    "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
  });
  cli(["baseline", dir], dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: baseline");
  git(dir, "checkout", "-q", "-b", "feat");
  writeFileSync(join(dir, "src/a.ts"), LONG(6));
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: six");
  const red = cli(["ratchet", dir, "--range", "auto"], dir);
  assert.equal(red.code, 3, red.out);
  assert.match(red.out, /change\.changelogMissing/);
  assert.match(red.out, /HARD FAIL/);
  assert.match(red.out, /feat: six: src\/a\.ts changed, CHANGELOG\.md not touched after it/);
  writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n- six\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "docs: changelog");
  const green = cli(["ratchet", dir, "--range", "auto"], dir);
  assert.equal(green.code, 0, green.out);
});

test("the root config: abatty.config.json exempts paths and names the baseline without an agent folder", () => {
  const dir = tempRepo("ratchet-root", {
    "package.json": PKG,
    "abatty.config.json": JSON.stringify({
      files: { baseline: "docs/floor.json" },
      ratchet: { exempt: ["^legacy/"] },
    }),
    "legacy/old.ts": LONG(400),
    "src/a.ts": LONG(5),
  });
  const base = cli(["baseline", dir], dir);
  assert.equal(base.code, 0, base.out);
  const floor = JSON.parse(readFileSync(join(dir, "docs/floor.json"), "utf8"));
  assert.equal(floor.metrics["size.overBudget"], 0, "legacy/ is exempt from the kind budget");
  assert.ok(floor.hard.includes("size.overBudget"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
});

test("C7 bidirectional: a floor above the current value is a finding until the improvement is locked", () => {
  // A one-sided ratchet accepts, for free and for ever, findings that no longer exist: the floor
  // keeps saying 9 where the tree measures 0, so nine may come back without the gate noticing.
  // The cure is `abatty baseline` in the change that earned the improvement, which is also the
  // only moment anyone knows why the number moved.
  const dir = tempRepo("ratchet-c7", {
    "package.json": PKG,
    "src/a.ts": LONG(310),
    "src/b.ts": LONG(310),
  });
  const config = DEFAULT_CONFIG;
  writeBaseline({
    repoDir: dir,
    rel: "scripts/ci/standards-baseline.json",
    measurements: measure(dir, null),
    config,
    previous: null,
    today: "2026-09-18",
  });
  const baseline = readBaseline(dir, "scripts/ci/standards-baseline.json");
  assert.ok(baseline);
  assert.equal(baseline.metrics["size.overBudget"], 2);
  assert.equal(failed(compare(measure(dir, baseline), baseline, config)), false, "level holds");

  // One file cured: the total falls below its floor, and the run is red until it is recorded.
  writeFileSync(join(dir, "src/b.ts"), LONG(10));
  const better = compare(measure(dir, baseline), baseline, config);
  const v = better.find((x) => x.metric === "size.overBudget");
  assert.equal(v?.status, "improved");
  assert.equal(failed(better), true, "an unlocked floor fails the run");
  assert.match(v?.messages.join("\n") || "", /2 → 1/);
  assert.match(v?.messages.join("\n") || "", /accepting 1 finding\(s\) that no longer exist/);

  // Locked in, the same tree is green, and the floor now refuses the finding coming back.
  writeBaseline({
    repoDir: dir,
    rel: "scripts/ci/standards-baseline.json",
    measurements: measure(dir, baseline),
    config,
    previous: baseline,
    today: "2026-09-18",
  });
  const locked = readBaseline(dir, "scripts/ci/standards-baseline.json");
  assert.ok(locked);
  assert.equal(locked.metrics["size.overBudget"], 1, "the floor moved down to what was earned");
  assert.equal(failed(compare(measure(dir, locked), locked, config)), false, "green once locked");
  writeFileSync(join(dir, "src/b.ts"), LONG(310));
  const back = compare(measure(dir, locked), locked, config);
  assert.equal(back.find((x) => x.metric === "size.overBudget")?.status, "regressed");
});

test("the findings a change introduced are separated from the debt it inherited", () => {
  // A finding in a file this change never touched is not this change's finding, however true it
  // is. Reported in one list, an author learns to scroll past both.
  const verdicts = /** @type {any} */ ([
    {
      metric: "size.overBudget",
      kind: "hard",
      status: "hard-fail",
      value: 2,
      floor: 0,
      scanned: 9,
      messages: [],
      findings: [
        { path: "src/mine.mjs", line: 12, detail: "301 > 300" },
        { path: "src/theirs.mjs", detail: "400 > 300" },
      ],
    },
    {
      metric: "types.escapes",
      kind: "ratchet",
      status: "ok",
      value: 1,
      floor: 1,
      scanned: 9,
      messages: [],
      findings: [{ path: "src/mine.mjs", detail: "one any" }],
    },
  ]);
  const split = splitByRange(verdicts, ["src/mine.mjs", "docs/README.md"]);
  assert.deepEqual(
    split.introduced.map((x) => [x.metric, x.finding.path]),
    [
      ["size.overBudget", "src/mine.mjs"],
      ["types.escapes", "src/mine.mjs"],
    ],
  );
  assert.deepEqual(
    split.standing.map((x) => x.finding.path),
    ["src/theirs.mjs"],
  );
  // The control in the other direction: a range that touched nothing the probes found leaves
  // every finding standing, and none of them is reported as this author's.
  const none = splitByRange(verdicts, ["README.md"]);
  assert.equal(none.introduced.length, 0);
  assert.equal(none.standing.length, 3);
});

test("a reason is recorded against its metric: an unrelated rebaseline keeps it, and the debt going away removes it", () => {
  const dir = tempRepo("ratchet-entries", {
    "package.json": PKG,
    "src/a.ts": LONG(310),
    "docs/x.md": "# x\n",
  });
  const config = DEFAULT_CONFIG;
  const rel = "scripts/ci/standards-baseline.json";
  const write = (/** @type {any} */ extra) =>
    writeBaseline({
      repoDir: dir,
      rel,
      measurements: measure(dir, readBaseline(dir, rel)),
      config,
      previous: readBaseline(dir, rel),
      today: "2026-09-16",
      ...extra,
    });
  assert.equal(write({ today: "2026-09-15" }).ok, true);

  // size.overBudget rises, and is explained.
  writeFileSync(join(dir, "src/b.ts"), LONG(310));
  assert.equal(write({ reason: "phase 8 splits these two", owner: "platform" }).ok, true);
  assert.equal(readBaseline(dir, rel)?.entries?.["size.overBudget"]?.owner, "platform");

  // The raise is in the report, in the open and marked for what it is: the owner is a string
  // the command was given, so the row says unverified until a raise can carry an approval the
  // raiser cannot give itself. A reader sees the claim rather than nothing.
  const raised = cli(["report", dir], dir);
  assert.equal(raised.code, 0, raised.out);
  assert.match(
    raised.out,
    /floor raised \(unverified\) size\.overBudget 1 → 2 on 2026-09-16 by platform: phase 8 splits these two/,
  );
  const json = JSON.parse(cli(["report", dir, "--json"], dir).out);
  assert.deepEqual(
    json.floors.raised.map((/** @type {any} */ f) => f.metric).sort(),
    ["size.excessCode", "size.overBudget"],
    "every metric the one write raised, one row each",
  );
  assert.deepEqual(
    json.floors.raised.find((/** @type {any} */ f) => f.metric === "size.overBudget"),
    {
      metric: "size.overBudget",
      at: "2026-09-16",
      was: 1,
      now: 2,
      reason: "phase 8 splits these two",
      owner: "platform",
      verified: false,
    },
  );

  // a later write that touches nothing keeps the explanation on the metric it belongs to
  assert.equal(write({ today: "2026-09-17" }).ok, true);
  assert.equal(
    readBaseline(dir, rel)?.entries?.["size.overBudget"]?.reason,
    "phase 8 splits these two",
    "an unrelated write does not erase another metric's reason",
  );

  // the debt is paid: the reason for it goes with it rather than covering the next rise
  writeFileSync(join(dir, "src/b.ts"), LONG(10));
  assert.equal(write({ today: "2026-09-18" }).ok, true);
  assert.equal(readBaseline(dir, rel)?.metrics["size.overBudget"], 1);
  assert.equal(readBaseline(dir, rel)?.entries?.["size.overBudget"], undefined);
  // and the row goes with it: the control in the other direction
  assert.ok(!/floor raised/.test(cli(["report", dir], dir).out));
});

test("a floor written under an older definition of a metric is reported, never compared", () => {
  const dir = tempRepo("ratchet-version", { "package.json": PKG, "src/a.ts": LONG(310) });
  const config = DEFAULT_CONFIG;
  const rel = "scripts/ci/standards-baseline.json";
  writeBaseline({
    repoDir: dir,
    rel,
    measurements: measure(dir, null),
    config,
    previous: null,
    today: "2026-09-16",
  });
  const baseline = readBaseline(dir, rel);
  assert.equal(baseline?.versions?.["size.overBudget"], 1, "the definition is recorded");

  // the control in the clean direction: the same definition still compares
  assert.equal(
    compare(measure(dir, baseline), baseline, config).find((v) => v.metric === "size.overBudget")
      ?.status,
    "ok",
  );

  // and in the other: the probe now counts something else, so the floor answers another question
  const redefined = BUILTIN_PROBES.map((p) =>
    p.metric === "size.overBudget" ? { ...p, version: 2 } : p,
  );
  const measured = measureAll(redefined, buildContext(dir), { config, range: "" }, baseline);
  const v = compare(measured, baseline, config).find((x) => x.metric === "size.overBudget");
  assert.equal(v?.status, "redefined");
  assert.match(v?.messages.join("\n") || "", /written under definition 1 .* definition 2/);
  assert.equal(
    failed(compare(measured, baseline, config)),
    true,
    "the run is red until rebaselined",
  );

  // a baseline from before the field exists is taken at its word rather than declared stale
  const older = { ...baseline, versions: undefined };
  assert.equal(
    compare(measured, older, config).find((x) => x.metric === "size.overBudget")?.status,
    "ok",
  );
});

test("a probe that stands in for something it cannot measure says so where the number is read", () => {
  const proxies = BUILTIN_PROBES.filter((p) => p.approximates);
  assert.ok(proxies.length >= 2, "docs.behindCode and startup.eagerModules at least");
  for (const p of proxies)
    assert.match(
      String(p.approximates),
      /stands in for|instead|it is wrong|belong to the machine/,
      `${p.metric}: the field says what the count is not, or it is decoration`,
    );

  const dir = tempRepo("ratchet-proxy", {
    "package.json": PKG,
    "docs/x.md": "---\ntitle: x\nsource_truth: [src/a.ts]\nlast_verified: '2020-01-01'\n---\n# x\n",
    "src/a.ts": "export const x = 1;\n",
  });
  const v = compare(measure(dir, null), null, DEFAULT_CONFIG);
  const behind = v.find((x) => x.metric === "docs.behindCode");
  assert.match(String(behind?.approximates), /never as a verdict/);
  assert.equal(
    v.find((x) => x.metric === "types.escapes")?.approximates,
    undefined,
    "a probe that measures what it says carries none",
  );
});

test("a probe that counts occurrences reports each one on its line, and the totals do not move", () => {
  const dir = tempRepo("probe-lines", {
    "package.json": PKG,
    "src/a.ts": [
      "export const one = process.env.A;",
      "export const two = process.env.B;",
      "",
      "export const three: any = 1;",
    ].join("\n"),
  });
  const measured = measure(dir, null);
  const env = measured.find((m) => m.metric === "valid.rawEnv");
  const esc = measured.find((m) => m.metric === "types.escapes");

  // The line is what puts the finding on the diff line in a forge rather than at the top of the
  // file. A probe that knows the offset and throws it away cannot be placed by any renderer.
  assert.deepEqual(
    env?.findings.map((f) => f.line),
    [1, 2],
  );
  assert.deepEqual(
    esc?.findings.map((f) => f.line),
    [4],
  );

  // And the invariant that made this safe to change: one finding per occurrence sums to exactly
  // what one finding per file with a weight summed to, so no floor moves under anybody.
  assert.equal(env?.value, 2);
  assert.equal(env?.debt["src/a.ts"], 2);
  assert.equal(esc?.value, 1);
});

test("the front matter reads the same with CRLF as with LF: the last key is not dropped on Windows", () => {
  // Checked out with CRLF, the closing `---` was found but the line before it kept its `\r`,
  // and `(.*)$` stopped before it: the last key of every document vanished, and the ratchet
  // went red on one operating system only (an outside trial, on Windows, found it in a day).
  const lf = '---\ntitle: T\nstatus: living\nlast_verified: "2026-09-21"\n---\n# T\n';
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.deepEqual(frontMatter(crlf), frontMatter(lf));
  assert.equal(frontMatter(crlf)?.last_verified, "2026-09-21", "the last key survives CRLF");
  assert.equal(frontMatter("\ufeff" + crlf)?.title, "T", "and a byte-order mark before it");
  assert.deepEqual(frontMatter("---\r\ntags: [a, b]\r\nrelated:\r\n  - ./x.md\r\n---\r\n"), {
    tags: ["a", "b"],
    related: ["./x.md"],
  });
});

test("an opt-in probe runs only where enabled, and until then its name is the repository's to use", async () => {
  const own = `export const probes = [
  { metric: "valid.wholeEnv", kind: "ratchet", standard: [], title: "mine", why: "a repository's own reading, written before the package had one",
    scan: () => ({ scanned: 1, findings: [] }), controls: [{ name: "a", expect: 1 }, { name: "b", expect: 0 }] },
];
`;
  const dir = tempRepo("ratchet-optin", { "package.json": PKG, "abatty.probes.mjs": own });
  const off = await loadProbes(dir, DEFAULT_CONFIG);
  assert.equal(
    off.probes.filter((p) => p.metric === "api.rowReturn").length,
    0,
    "not enabled, not run",
  );
  assert.equal(off.probes.find((p) => p.metric === "valid.wholeEnv")?.source, "abatty.probes.mjs");
  assert.deepEqual(off.problems, []);

  const on = await loadProbes(dir, {
    ...DEFAULT_CONFIG,
    enable: ["valid.wholeEnv", "api.rowReturn", "no.suchProbe"],
  });
  assert.equal(on.probes.find((p) => p.metric === "valid.wholeEnv")?.source, "abatty");
  assert.ok(on.probes.some((p) => p.metric === "api.rowReturn"));
  assert.match(on.problems.join("\n"), /valid\.wholeEnv: a built-in metric name/);
  assert.match(on.problems.join("\n"), /no\.suchProbe is not an opt-in probe/);
});
