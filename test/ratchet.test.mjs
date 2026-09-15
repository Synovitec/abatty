import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  validateProbe,
  writeBaseline,
} from "../src/ratchet/index.mjs";
import { runControls } from "../src/ratchet/controls.mjs";
import { buildContext } from "../src/rules/context.mjs";

/** A file of n export lines. @param {number} n */
const LONG = (n) =>
  Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const PKG = JSON.stringify({ name: "fixture", version: "0.1.0", scripts: {} }) + "\n";

// P-1: a probe with no failing control case is not added. Every built-in probe proves itself
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
    /a floor never rises without a reason: size\.overBudget 1 → 2/,
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
  assert.equal(allowed.ok, true);
  assert.equal(readBaseline(dir, rel)?.metrics["size.overBudget"], 2);
  assert.equal(
    /** @type {any} */ (readBaseline(dir, rel))?.lastReason?.reason,
    "the split of a.ts is phase 8",
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

test("the CLI: ratchet is red without a floor, baseline writes it, ratchet is green, --json carries the verdicts, --controls runs the cases", () => {
  const dir = tempRepo("ratchet-cli", {
    "package.json": PKG,
    "src/a.ts": LONG(310),
    "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
  });
  const red = cli(["ratchet", dir], dir);
  assert.equal(red.code, 1, red.out);
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
  assert.equal(red.code, 1, red.out);
  assert.match(red.out, /change\.changelogMissing/);
  assert.match(red.out, /HARD FAIL/);
  assert.match(red.out, /feat: six \(no CHANGELOG\.md touch after it\)/);
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
