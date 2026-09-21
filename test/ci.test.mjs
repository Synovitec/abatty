import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { presets, presetById } from "../src/presets/index.mjs";
import { ciSteps } from "../src/ci/generate.mjs";
import { renderGithubActions } from "../src/ci/github.mjs";
import { renderWoodpecker } from "../src/ci/woodpecker.mjs";
import { renderPullRequestTemplate, renderRuleset } from "../src/ci/templates.mjs";
import { FORBIDDEN, TERMS } from "../src/core/vocabulary.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { phantomScripts } from "../src/rules/families/instrument.mjs";

test("the CI steps are the gate's steps in the gate's order, then the secret scan, the audit and the publish step; the suites follow by kind", () => {
  for (const p of presets) {
    const steps = ciSteps(p, { base: "main" });
    const gateLabels = p.gate.always.map((s) => s.label);
    assert.deepEqual(
      steps.slice(0, gateLabels.length).map((s) => s.name),
      gateLabels,
      p.id,
    );
    assert.ok(
      steps.some((s) => /npx abatty secrets --range origin\/main\.\.HEAD/.test(s.command)),
      `${p.id}: secret scan, one implementation`,
    );
    assert.ok(
      steps.some((s) => /npm audit/.test(s.command)),
      `${p.id}: audit`,
    );
    assert.match(
      steps.find((s) => /npm run -s standards/.test(s.command))?.command || "",
      /--range origin\/main\.\.HEAD/,
    );
    assert.match(steps.at(-1)?.command || "", /abatty publish/);
    const kinds = new Set(steps.map((s) => s.when));
    if (p.gate.suites.some((s) => /database/i.test(s.name)))
      assert.ok(kinds.has("db"), `${p.id}: a database job`);
    if (p.gate.suites.some((s) => /browser/i.test(s.name)))
      assert.ok(kinds.has("browser"), `${p.id}: a browser job`);
  }
});

test("both providers render every step and the suites, guard the publish step behind the secret, and name no tool", () => {
  for (const p of presets) {
    const wp = renderWoodpecker(p);
    const gh = renderGithubActions(p);
    for (const s of p.gate.always) {
      if (s.builtin) continue; // the scan and the audit are asserted by their own commands below
      const cmd = s.command ? s.command.join(" ") : `npm run -s ${s.script}`;
      assert.ok(
        wp.includes(cmd) || (s.script === "standards" && wp.includes("npm run -s standards")),
        `${p.id} woodpecker: ${s.label}`,
      );
      assert.ok(
        gh.includes(cmd) || (s.script === "standards" && gh.includes("npm run -s standards")),
        `${p.id} github: ${s.label}`,
      );
    }
    assert.match(wp, /^when:\n  - event: \[push, pull_request\]/m);
    assert.match(wp, /secrets: \[abatty_dashboard, abatty_token\]/);
    assert.match(gh, /^name: checks\n/m);
    assert.match(gh, /if: \$\{\{ env\.ABATTY_DASHBOARD != '' \}\}/);
    assert.match(gh, /npx abatty secrets --range/);
    assert.match(wp, /npx abatty secrets --range/);
    if (p.gate.suites.some((s) => /database/i.test(s.name))) {
      assert.match(wp, /image: postgres:16/);
      assert.match(gh, /^  database:\n    needs: checks/m);
    }
    if (p.gate.suites.some((s) => /browser/i.test(s.name))) {
      assert.match(gh, /playwright install --with-deps/);
      assert.match(wp, /mcr\.microsoft\.com\/playwright/);
    }
    assert.ok(!FORBIDDEN.test(wp) && !FORBIDDEN.test(gh), `${p.id}: the pipeline names no tool`);
  }
  assert.match(renderPullRequestTemplate(), /No floor raised, no threshold lowered/);
});

test("the ruleset is valid JSON that refuses a branch naming a tool and requires the checks; it is printed, never written", () => {
  // A sample branch built from the vocabulary at runtime, so this file names no tool.
  const sample = TERMS.find((t) => /^[a-z]+$/.test(t)) || "tool";
  const r = JSON.parse(renderRuleset({ checks: ["checks", "database"] }));
  assert.equal(r.target, "branch");
  const name = r.rules.find((/** @type {any} */ x) => x.type === "branch_name_pattern");
  assert.equal(name.parameters.negate, true);
  assert.ok(
    new RegExp(name.parameters.pattern.replace(/^\(\?i\)/, ""), "i").test(`feat/${sample}-fix`),
    "a branch that names a tool matches the refused pattern",
  );
  assert.ok(
    !new RegExp(name.parameters.pattern.replace(/^\(\?i\)/, ""), "i").test(
      "feat/repair-the-air-filter",
    ),
    "a word inside another word is not a match",
  );
  assert.deepEqual(
    r.rules
      .find((/** @type {any} */ x) => x.type === "required_status_checks")
      .parameters.required_status_checks.map((/** @type {any} */ c) => c.context),
    ["checks", "database"],
  );
  const dir = tempRepo("ci-ruleset", { "package.json": NEXT_PKG });
  const out = cli(["ci", dir, "--ruleset"], dir);
  assert.equal(out.code, 0, out.out);
  assert.equal(JSON.parse(out.out).name, "abatty");
  assert.equal(existsSync(join(dir, ".github")), false, "nothing written");
});

test("abatty ci writes the providers' files from the gate, --check says when they are behind, init --ci writes them, and the CI rules read them", () => {
  const dir = tempRepo("ci-write", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const w = cli(["ci", dir, "--provider", "woodpecker,github"], dir);
  assert.equal(w.code, 0, w.out);
  // Rendered from the repository's own scripts (test and build) and its package manager (none
  // committed: npm), which is what the written file must equal.
  const scripts = JSON.parse(NEXT_PKG).scripts;
  assert.equal(
    readFileSync(join(dir, ".woodpecker/checks.yaml"), "utf8").trim(),
    renderWoodpecker(
      /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next")),
      { base: "main", scripts, pm: null },
    ).trim(),
  );
  assert.ok(existsSync(join(dir, ".github/workflows/checks.yml")));
  assert.ok(existsSync(join(dir, ".github/PULL_REQUEST_TEMPLATE.md")));
  assert.equal(cli(["ci", dir, "--provider", "github", "--check"], dir).code, 0, "in step");
  writeFileSync(join(dir, ".github/workflows/checks.yml"), "name: old\n");
  const behind = cli(["ci", dir, "--provider", "github", "--check"], dir);
  assert.equal(behind.code, 3, "the check ran and found the pipeline behind");
  assert.match(behind.out, /behind\s+\.github\/workflows\/checks\.yml/);
  assert.equal(cli(["ci", dir, "--provider", "nope"], dir).code, 2);
  // The fixture has `test` and `build` and nothing else: the pipeline names no script the
  // package lacks (the absent steps are comments that say so), so INST-CI is present, and
  // INST-CI-STEPS says what is missing rather than crediting a word.
  const findings = runCatalog(buildContext(dir), RULES);
  const ci = findings.find((f) => f.id === "INST-CI");
  assert.equal(ci?.status, "present", ci?.evidence);
  const steps = findings.find((f) => f.id === "INST-CI-STEPS");
  assert.equal(steps?.status, "partial");
  assert.match(steps?.evidence || "", /MISSING lint/);
  assert.match(steps?.evidence || "", /ok test/);
  const written = readFileSync(join(dir, ".woodpecker/checks.yaml"), "utf8");
  assert.match(written, /# lint: no "lint" script in package\.json; the gap analysis names it/);
  assert.ok(!/npm run -s lint/.test(written), "a script the package lacks is not a step");
  const fresh = tempRepo("ci-init", { "package.json": NEXT_PKG });
  const init = cli(["init", fresh, "--stack", "next", "--ci", "github"], fresh);
  assert.equal(init.code, 0, init.out);
  assert.ok(existsSync(join(fresh, ".github/workflows/checks.yml")));
  assert.match(init.out, /written\s+\.github\/workflows\/checks\.yml/);
});

test("the generated pipeline emits SARIF and uploads it, so findings land on the diff", () => {
  // The strongest finding in the evidence base is about placement rather than precision: the same
  // analysis reached a near-zero fix rate as a report and above seventy per cent on the change
  // under review. This is that delivery, through a standard rather than through a bot we build.
  const preset = presetById("next");
  assert.ok(preset);
  const yaml = renderGithubActions(preset, { base: "main" });
  assert.match(yaml, /security-events: write/, "the upload needs the permission");
  assert.match(yaml, /abatty ratchet --range auto --sarif > abatty\.sarif/);
  assert.match(yaml, /github\/codeql-action\/upload-sarif@v3/);
  assert.match(yaml, /sarif_file: abatty\.sarif/);
  // Both steps run even when the gate went red, because that is the run whose findings matter.
  const upload = yaml.slice(
    yaml.indexOf("findings as SARIF"),
    yaml.indexOf("the conformance statement"),
  );
  assert.equal((upload.match(/if: always\(\)/g) || []).length, 2);
});

test("the generated pipeline signs the conformance statement with the run's identity, never with a key", () => {
  const preset = presetById("next");
  assert.ok(preset);
  const yaml = renderGithubActions(preset, { base: "main" });
  assert.match(yaml, /id-token: write/, "the workload identity the signature is made with");
  assert.match(yaml, /attestations: write/, "the write the transparency log needs");
  assert.match(yaml, /npx abatty attest --out abatty-conformance\.json/);
  assert.match(yaml, /uses: actions\/attest@v2/);
  assert.match(yaml, /predicate-type: https:\/\/abatty\.dev\/attestation\/conformance\/v1/);
  // The package prints and never signs: no key, no secret, nothing to leak out of a repository.
  assert.equal(/cosign sign|--key |GPG|gpg --|secrets\.SIGNING/i.test(yaml), false);
  // and the same in this repository's own release, which is the one that publishes
  const release = readFileSync(
    fileURLToPath(new URL("../.github/workflows/release.yml", import.meta.url)),
    "utf8",
  );
  assert.match(release, /npm publish --provenance/);
  assert.match(release, /attest --out abatty-conformance\.json/);
  assert.match(release, /uses: actions\/attest@v2/);
  assert.match(release, /attestations: write/);
});

test("a CI step is credited for the script behind it, not for the word: phantom scripts are named in both directions", () => {
  const CI = [
    "steps:",
    "  - run: npm ci",
    "  - run: npm run -s lint",
    "  - run: pnpm run typecheck",
    "  - run: yarn test",
    "  - run: bun run --silent standards -- --range auto",
    "  - run: yarn install --frozen-lockfile",
    "  - run: npx abatty secrets --range origin/main..HEAD",
    "  - run: npm audit --audit-level=high",
    "",
  ].join("\n");
  assert.deepEqual(phantomScripts(CI, { test: "x", standards: "y" }).sort(), ["lint", "typecheck"]);
  assert.deepEqual(
    phantomScripts(CI, { test: "x", standards: "y", lint: "z", typecheck: "w" }),
    [],
  );

  const pkg = (/** @type {Record<string, string>} */ scripts) =>
    JSON.stringify({ name: "p", private: true, scripts, dependencies: { next: "15" } });
  const verdicts = (/** @type {string} */ name, /** @type {Record<string, string>} */ scripts) => {
    const dir = tempRepo(name, {
      "package.json": pkg(scripts),
      ".github/workflows/checks.yml": CI,
    });
    const f = runCatalog(buildContext(dir), RULES);
    return {
      ci: f.find((x) => x.id === "INST-CI"),
      steps: f.find((x) => x.id === "INST-CI-STEPS"),
    };
  };
  const ghost = verdicts("ci-phantom", { test: "x", standards: "y" });
  assert.equal(ghost.ci?.status, "partial");
  assert.match(ghost.ci?.evidence || "", /does not have: lint, typecheck/);
  assert.equal(ghost.steps?.status, "partial");
  assert.match(
    ghost.steps?.evidence || "",
    /NAMED, no script lint, NAMED, no script typecheck, ok test, ok standards/,
  );

  const real = verdicts("ci-real", { test: "x", standards: "y", lint: "z", typecheck: "w" });
  assert.equal(real.ci?.status, "present", real.ci?.evidence);
  assert.equal(real.steps?.status, "present", real.steps?.evidence);
});

test("the pipeline is the repository's: its package manager's install and audit, its scripts and no other", () => {
  // The generated pipeline said `npm ci` and `npm run -s <five scripts the package lacked>` to a
  // pnpm repository, and was red on its first run. Both directions: pnpm and npm on one preset.
  const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next"));
  const pnpm = tempRepo("ci-pnpm", {
    "package.json": NEXT_PKG,
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "src/a.ts": "export const a = 1;\n",
  });
  const w = cli(["ci", pnpm, "--provider", "woodpecker,github"], pnpm);
  assert.equal(w.code, 0, w.out);
  const gh = readFileSync(join(pnpm, ".github/workflows/checks.yml"), "utf8");
  assert.match(gh, /uses: pnpm\/action-setup@v4/);
  assert.match(gh, /cache: pnpm/);
  assert.match(gh, /run: pnpm install --frozen-lockfile/);
  assert.match(gh, /run: pnpm audit --audit-level=high --prod/);
  assert.match(gh, /pnpm exec abatty secrets --range origin\/main\.\.HEAD/);
  assert.match(gh, /run: pnpm run -s test\n/);
  assert.ok(
    !/\bnpm ci\b|\bnpx |\bnpm run|\bnpm audit/.test(gh),
    "nothing npm-shaped in a pnpm pipeline",
  );
  assert.match(
    gh,
    /# database: no runnable step yet/,
    "a job with no runnable step is a comment, not an empty job",
  );
  assert.match(gh, /run: pnpm exec playwright install --with-deps/);
  const wp = readFileSync(join(pnpm, ".woodpecker/checks.yaml"), "utf8");
  assert.match(wp, /- corepack enable\n\s+- pnpm install --frozen-lockfile/);
  assert.match(wp, /# lint: no "lint" script in package\.json/);
  assert.equal(
    cli(["ci", pnpm, "--provider", "github", "--check"], pnpm).code,
    0,
    "in step with itself",
  );

  // The same preset with the standards script present and an alternative for the e2e step: the
  // step runs the script the package has, under its own name.
  const steps = ciSteps(preset, {
    base: "main",
    scripts: { test: "x", standards: "abatty ratchet", "test:e2e": "playwright test" },
    pm: null,
  });
  assert.match(
    steps.find((s) => /ratchet/.test(s.name))?.command || "",
    /^git fetch --no-tags origin main && npm run -s standards -- --range origin\/main\.\.HEAD$/,
  );
  assert.equal(steps.find((s) => /E2E/.test(s.name))?.command, "npm run -s test:e2e");
  assert.ok(
    steps.find((s) => /^lint/.test(s.name))?.absent,
    "no lint script: absent, with the reason",
  );
  // Without scripts, every step of the preset is rendered: the preset alone, for a reader.
  assert.ok(ciSteps(preset, { base: "main" }).every((s) => !s.absent));
});
