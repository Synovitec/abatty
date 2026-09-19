import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { presets, presetById } from "../src/presets/index.mjs";
import {
  ciSteps,
  renderGithubActions,
  renderPullRequestTemplate,
  renderRuleset,
  renderWoodpecker,
} from "../src/ci/generate.mjs";
import { FORBIDDEN, TERMS } from "../src/core/vocabulary.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";

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
  assert.equal(
    readFileSync(join(dir, ".woodpecker/checks.yaml"), "utf8").trim(),
    renderWoodpecker(
      /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next")),
      { base: "main" },
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
  const findings = runCatalog(buildContext(dir), RULES);
  assert.equal(findings.find((f) => f.id === "INST-CI")?.status, "present");
  assert.equal(
    findings.find((f) => f.id === "INST-CI-STEPS")?.status,
    "present",
    "lint, typecheck, test, standards, secret scan, audit are all in the generated pipeline",
  );
  const fresh = tempRepo("ci-init", { "package.json": NEXT_PKG });
  const init = cli(["init", fresh, "--stack", "next", "--ci", "github"], fresh);
  assert.equal(init.code, 0, init.out);
  assert.ok(existsSync(join(fresh, ".github/workflows/checks.yml")));
  assert.match(init.out, /written\s+\.github\/workflows\/checks\.yml/);
});
