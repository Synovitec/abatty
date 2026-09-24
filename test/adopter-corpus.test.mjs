import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cli, git } from "./helpers.mjs";
import { docsAdopter, productAdopter } from "./adopters/fixtures.mjs";
import { testRunEnv } from "../src/core/env.mjs";
import { narrowFallbacks } from "../src/ci/fallback.mjs";
import { unrefusedSecrets } from "../src/core/secret-reads.mjs";
import { missingGateScripts } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import { suiteEnvGaps } from "../src/core/suite-env.mjs";
import { offProbes } from "../src/core/opt-in.mjs";
import { RULES } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { BUILTIN_PROBES } from "../src/ratchet/index.mjs";

// Every report an adopter sent, as a case against a repository shaped like theirs (never their
// code: test/adopters/fixtures.mjs). A case names the report, the claim, and what holds now; the
// dedicated tests elsewhere prove each fix in both directions, and this file keeps the adopter's
// own situation from coming back. A new report adds a case here before its fix lands.

const GUARD = fileURLToPath(new URL("../templates/harness/hooks/guard.mjs", import.meta.url));

/** The guard's decision on a command run in `dir`, by day or at night. @param {string} dir @param {string} command @param {boolean} [night] */
function guard(dir, command, night = false) {
  const env = {
    ...testRunEnv(),
    ADOPTION_RUN: night ? "1" : "",
    ADOPTION_BRANCH: night ? "adopt/x" : "",
    DATABASE_URL: "",
  };
  const r = spawnSync(process.execPath, [GUARD], {
    cwd: dir,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env,
  });
  try {
    return String(JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision || "none");
  } catch {
    return "none";
  }
}

const node = /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("node"));

/** @type {{ report: string, claim: string, run: () => void | Promise<void> }[]} */
const CASES = [
  {
    report: "product · 2026-09-24 · db:setup",
    claim: "a script that force-resets the database is refused at night and asked about by day",
    run: () => {
      const dir = productAdopter();
      assert.equal(guard(dir, "pnpm db:setup", true), "deny");
      assert.equal(guard(dir, "npm run setup", true), "deny");
      assert.equal(guard(dir, "pnpm db:setup"), "ask");
      assert.equal(guard(dir, "pnpm lint", true), "none");
    },
  },
  {
    report: "product · 2026-09-24 · prisma db push",
    claim: "a schema push on the base branch is a migration, not a git push",
    run: () => assert.equal(guard(productAdopter(), "pnpm exec prisma db push"), "ask"),
  },
  {
    report: "product · 2026-09-24 · hooks folder",
    claim: "at night the hooks folder is protected by its bare name",
    run: () => {
      const dir = productAdopter();
      for (const c of [
        "rm -rf .githooks",
        "rmdir .githooks",
        "find .githooks -delete",
        "rm -rf .husky",
      ])
        assert.equal(guard(dir, c, true), "deny", c);
      assert.equal(guard(dir, "ls .githooks", true), "none");
    },
  },
  {
    report: "product · 2026-09-24 · narrowed env deny",
    claim: "an env file the settings no longer refuse is named",
    run: () => {
      const settings = JSON.parse(
        readFileSync(join(productAdopter(), ".claude/settings.json"), "utf8"),
      );
      assert.ok(unrefusedSecrets(settings).includes(".env.staging"));
    },
  },
  {
    report: "product · 2026-09-24 · test:changed",
    claim: "the changed-lines step run under its other name is not absent",
    run: () =>
      assert.equal(missingGateScripts(productAdopter(), node).includes("coverage:changed"), false),
  },
  {
    report: "product · 2026-09-24 · HEAD~1 fallback",
    claim: "a pipeline that judges a new branch by its last commit is named",
    run: () => assert.equal(narrowFallbacks(productAdopter()).length, 1),
  },
  {
    report: "product · 2026-09-24 · missing auth env",
    claim: "the example env file's names nothing sets are listed before a suite runs",
    run: () => {
      const gaps = suiteEnvGaps([productAdopter()]);
      assert.ok(gaps.includes("NEXTAUTH_SECRET") && !gaps.includes("DATABASE_URL"), gaps.join(","));
    },
  },
  {
    report: "product · 2026-09-24 · coverage exclusions",
    claim: "an opt-in probe left off is named with the total the ratchet would record",
    run: () => {
      const off = offProbes(productAdopter());
      assert.equal(off.find((p) => p.metric === "test.coverageExclusions")?.reads, 3);
    },
  },
  {
    report: "product · 2026-09-23 · hydration",
    claim: "a browser suite without a pageerror and hydration listener is not credited",
    run: () => {
      const rule = RULES.find((r) => r.id === "TEST-E2E-ERRORS");
      assert.equal(rule?.check(buildContext(productAdopter())).status, "missing");
    },
  },
  {
    report: "product · 2026-09-23 · journeys",
    claim: "a page reached through a helper's templated path is opened; one no test names is not",
    run: () => {
      const probe = BUILTIN_PROBES.find((p) => p.metric === "test.unvisitedRoutes");
      const r = probe?.scan(
        buildContext(productAdopter(), { tracked: true }),
        /** @type {any} */ ({}),
      );
      const unopened = (r?.findings || []).map((f) => String(f.detail));
      assert.ok(!unopened.some((d) => d.startsWith("/admin/login")), "opened by the helper");
      assert.ok(
        unopened.some((d) => d.includes("/dishes/[dishId]/edit")),
        "the dish edit form",
      );
    },
  },
  {
    report: "product · 2026-09-24 · help writes",
    claim: "a help flag never writes the baseline",
    run: () => {
      const dir = productAdopter();
      assert.equal(cli(["baseline", dir, "--help"], dir).code, 0);
      assert.throws(() => readFileSync(join(dir, "scripts/ci/standards-baseline.json")));
    },
  },
  {
    report: "docs · 2026-09-24 · front matter",
    claim: "a cited document whose front matter alone changed has not moved",
    run: () => {
      const { dir, FM } = docsAdopter();
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src/shifts-pay.ts"), "export const pay = 1;\n");
      writeFileSync(
        join(dir, "docs/domain/shifts.md"),
        FM(`source_truth:\n  - "src/shifts-pay.ts"\n`) + "How shifts are paid.\n",
      );
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "-m", "refactor: split shifts");
      const probe = BUILTIN_PROBES.find((p) => p.metric === "docs.behindCode");
      const r = probe?.scan(buildContext(dir, { tracked: true }), /** @type {any} */ ({}));
      const behind = (r?.findings || []).map((f) => f.path);
      assert.equal(behind.includes("docs/product/module.md"), false, behind.join(","));
    },
  },
];

for (const c of CASES) test(`${c.report}: ${c.claim}`, c.run);
