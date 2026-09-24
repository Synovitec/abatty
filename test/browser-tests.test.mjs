import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { RULES } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { ERROR_FIXTURE } from "../src/rules/families/browser-tests.mjs";
import { planFix } from "../src/core/fix.mjs";

// An adopter shipped a hydration mismatch through sixty-two green browser tests: the runner
// passes a page that threw or failed to hydrate unless a test listens.

const PKG = JSON.stringify({ name: "b", devDependencies: { "@playwright/test": "1.50.0" } });
const SPEC_FROM_FIXTURE =
  'import { test, expect } from "./fixtures";\ntest("home", async ({ page }) => { await page.goto("/"); });\n';
const SPEC_BARE =
  'import { test, expect } from "@playwright/test";\ntest("menu", async ({ page }) => { await page.goto("/menu"); });\n';

/** @param {Record<string, string>} files */
function judge(files) {
  const rule = RULES.find((r) => r.id === "TEST-E2E-ERRORS");
  assert.ok(rule);
  return rule.check(buildContext(tempRepo("e2e-errors", { "package.json": PKG, ...files })));
}

test("the fixture abatty fix writes holds the rule, for every spec that imports test from it", () => {
  const v = judge({ "e2e/fixtures.ts": ERROR_FIXTURE, "e2e/home.spec.ts": SPEC_FROM_FIXTURE });
  assert.equal(v.status, "present", v.evidence);
});

test("no listener is missing; a spec that takes test from the runner is partial, named", () => {
  assert.equal(judge({ "e2e/home.spec.ts": SPEC_BARE }).status, "missing");
  const bypass = judge({
    "e2e/fixtures.ts": ERROR_FIXTURE,
    "e2e/home.spec.ts": SPEC_FROM_FIXTURE,
    "e2e/menu.spec.ts": SPEC_BARE,
  });
  assert.equal(bypass.status, "partial");
  assert.match(
    bypass.evidence,
    /1 spec\(s\) take test from @playwright\/test and skip the listener: e2e\/menu\.spec\.ts/,
  );
  assert.equal(
    judge({
      "e2e/fixtures.ts":
        'import { test as base } from "@playwright/test";\nexport const test = base.extend({ page: async ({ page }, use) => { page.on("pageerror", (e) => { throw e; }); await use(page); } });\n',
    }).status,
    "partial",
    "pageerror alone does not hear a hydration mismatch",
  );
  assert.equal(
    RULES.find((r) => r.id === "TEST-E2E-ERRORS")?.check(
      buildContext(tempRepo("e2e-none", { "package.json": "{}" })),
    ).status,
    "n/a",
  );
});

test("abatty fix plans the fixture for phase 3 when the rule is open", () => {
  const dir = tempRepo("e2e-fix", { "package.json": PKG });
  const finding = /** @type {any} */ ({ id: "TEST-E2E-ERRORS", status: "missing", phase: "3" });
  const [step] = planFix({
    repoDir: dir,
    findings: [finding],
    phase: "3",
    name: "b",
    date: "2026-09-24",
  });
  assert.equal(step?.path, "e2e/fixtures.ts");
  assert.equal(step?.action, "write");
  assert.equal(step?.text, ERROR_FIXTURE);
});
