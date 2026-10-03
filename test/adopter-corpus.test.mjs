import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cli, git, tempRepo } from "./helpers.mjs";
import { docsAdopter, monorepoAdopter, productAdopter } from "./adopters/fixtures.mjs";
import { testRunEnv } from "../src/core/env.mjs";
import { narrowFallbacks } from "../src/ci/fallback.mjs";
import { unrefusedSecrets } from "../src/core/secret-reads.mjs";
import { missingGateScripts } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import { suiteEnvGaps } from "../src/core/suite-env.mjs";
import { offProbes } from "../src/core/opt-in.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { BUILTIN_PROBES } from "../src/ratchet/index.mjs";
import { resolveConfig } from "../src/ratchet/config.mjs";
import { STEP_CONTROLS } from "../src/core/step-plants.mjs";
import { runStepControls } from "../src/core/step-controls.mjs";
import { probationReadings } from "../src/core/probation.mjs";
import { undeclaredImports } from "../src/core/undeclared.mjs";

/** What the ratchet hands a probe with the default config and no range. */
const SCAN = { config: resolveConfig({}), range: "" };

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
      const r = probe?.scan(buildContext(productAdopter(), { tracked: true }), SCAN);
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
    report: "product · 2026-09-25 · help omits commands",
    claim: "ratchet --help prints the ratchet's usage, not the global screen without it",
    run: () => {
      const dir = productAdopter();
      const r = cli(["ratchet", dir, "--help", "--plain"], dir);
      assert.match(r.out, /abatty ratchet \[dir\]/);
      assert.ok(!/abatty measure/.test(r.out));
    },
  },
  {
    report: "product · 2026-09-25 · probation why",
    claim: "every check on probation says why its reading is or is not a vote",
    run: () => {
      const empty = probationReadings(productAdopter(), {}).filter((p) => !p.why);
      assert.deepEqual(empty, []);
    },
  },
  {
    report: "product · 2026-09-25 · catalog vs ratchet",
    claim: "TYPES-ESCAPES names the ratchet's own count, so the two cannot disagree",
    run: () => {
      const c = buildContext(productAdopter());
      const escapes = RULES.find((r) => r.id === "TYPES-ESCAPES")?.check(c);
      assert.match(String(escapes?.evidence), /\(types\.escapes: \d+\)|JavaScript repository/);
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
      const r = probe?.scan(buildContext(dir, { tracked: true }), SCAN);
      const behind = (r?.findings || []).map((f) => f.path);
      assert.equal(behind.includes("docs/product/module.md"), false, behind.join(","));
    },
  },
  {
    report: "product · 2026-09-25 · rc.1 replay, integration wrapper",
    claim: "a suite run through a wrapper gets its control where the wrapper's runner config looks",
    run: () => {
      const dir = productAdopter();
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const files = STEP_CONTROLS["test:integration"]?.files({
        deps: new Set(Object.keys(pkg.devDependencies)),
        pack: "javascript",
        dir,
        scripts: pkg.scripts,
      });
      assert.deepEqual(Object.keys(files || {}), ["tests/integration/abatty-control.__.test.ts"]);
    },
  },
  {
    report: "product · 2026-09-25 · rc.1 replay, controls after an upgrade",
    claim:
      "update says the next night is refused until the controls an older minor planted run again",
    run: () => {
      const dir = productAdopter();
      mkdirSync(join(dir, ".abatty"), { recursive: true });
      const at = new Date().toISOString();
      writeFileSync(join(dir, ".abatty/controls.json"), JSON.stringify({ abatty: "0.5.2", at }));
      const old = cli(["update", dir, "--dry-run"], dir);
      assert.match(old.out, /planted by abatty 0\.5\.2: a night is refused until/, old.out);
      const now = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
      writeFileSync(
        join(dir, ".abatty/controls.json"),
        JSON.stringify({ abatty: now.version, at }),
      );
      assert.doesNotMatch(cli(["update", dir, "--dry-run"], dir).out, /a night is refused/);
    },
  },
  {
    report: "monorepo · 2026-09-25 · rc.1 replay, turbo",
    claim: "a task runner's test plant goes to a workspace that runs the task, not to a root test/",
    run: () => {
      const dir = monorepoAdopter();
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const files = STEP_CONTROLS.test?.files({
        deps: new Set(),
        pack: "javascript",
        dir,
        scripts: pkg.scripts,
      });
      assert.deepEqual(Object.keys(files || {}), ["apps/mobile/lib/abatty-control.__.test.ts"]);
      assert.doesNotMatch(
        Object.values(files || {})[0] || "",
        /import/,
        "a jest workspace's plant uses jest's globals, not node:test",
      );
    },
  },
  {
    report: "monorepo · 2026-09-25 · rc.1 replay, a wrapper that changes folder",
    claim: "`controls` in the config names where a step's runner reads, and the plant goes there",
    run: () => {
      const dir = monorepoAdopter();
      const want = "apps/web/tests/integration/abatty-control.__.test.ts";
      writeFileSync(
        join(dir, "abatty.config.json"),
        JSON.stringify({ controls: { test: "apps/web/tests/integration" } }),
      );
      // The stub runner goes red only when the plant is where the config said.
      const r = runStepControls({
        repoDir: dir,
        preset: node,
        run: (_cwd, script) => (script === "test" && existsSync(join(dir, want)) ? 1 : 0),
      });
      const step = r.steps.find((s) => s.label.startsWith("unit tests"));
      assert.equal(step?.outcome, "red", JSON.stringify(r.steps));
      assert.equal(existsSync(join(dir, want)), false, "and removed after");
    },
  },
  {
    report: "monorepo · 2026-10-02 · rc.10, a shared lint config",
    claim: "the rules read the shared config package the root eslint config imports",
    run: () => {
      const dir = monorepoAdopter();
      writeFileSync(
        join(dir, "eslint.config.mjs"),
        'import base from "@acme/eslint-config";\nexport default [...base];\n',
      );
      mkdirSync(join(dir, "packages/eslint-config"), { recursive: true });
      writeFileSync(
        join(dir, "packages/eslint-config/package.json"),
        JSON.stringify({ name: "@acme/eslint-config", main: "index.mjs" }),
      );
      writeFileSync(
        join(dir, "packages/eslint-config/index.mjs"),
        'export default [{ rules: { "max-lines": 1, "max-lines-per-function": 1, complexity: 1, "max-params": 1 } }];\n',
      );
      git(dir, "add", "-A");
      const shape = runCatalog(buildContext(dir), RULES).find((f) => f.id === "CODE-SHAPE");
      assert.equal(shape?.status, "present", shape?.evidence);
    },
  },
  {
    report: "monorepo · 2026-10-02 · rc.10, observability readings",
    claim:
      "the logger's censor value is configuration, and a DSN read by bracket is from the environment",
    run: () => {
      const dir = monorepoAdopter();
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      pkg.dependencies = { express: "4", pino: "9", "@sentry/node": "8" };
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
      writeFileSync(
        join(dir, "apps/web/lib/logger.ts"),
        'export const log = pino({ redact: { paths: ["password"], censor: "[REDACTED]" } });\n',
      );
      writeFileSync(
        join(dir, "apps/web/instrumentation.ts"),
        'Sentry.init({ dsn: process.env["SENTRY_DSN"] });\n',
      );
      git(dir, "add", "-A");
      const found = runCatalog(buildContext(dir), RULES);
      for (const id of ["OBS-REDACTION", "OBS-TRACKER"]) {
        const x = found.find((r) => r.id === id);
        assert.equal(x?.status, "present", `${id}: ${x?.evidence}`);
      }
    },
  },
  {
    report: "monorepo · 2026-10-02 · rc.10, tamper per commit",
    claim:
      "a test case removed in one commit and restored in the next is not a way out the push took",
    run: () => {
      const dir = monorepoAdopter();
      const file = join(dir, "apps/web/lib/b.test.ts");
      const both = "test('one', () => {});\ntest('two', () => {});\n";
      writeFileSync(file, both);
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "test: two");
      writeFileSync(file, "test('one', () => {});\n");
      git(dir, "commit", "-qam", "wip");
      writeFileSync(file, both);
      git(dir, "commit", "-qam", "back");
      const probe = BUILTIN_PROBES.find((p) => p.metric === "change.testTamper");
      const r = probe?.scan(buildContext(dir), { ...SCAN, range: "HEAD~2..HEAD" });
      assert.equal(r?.findings.length, 0, JSON.stringify(r?.findings));
    },
  },
  {
    report: "monorepo · 2026-10-03 · rc.12, a tracker read through the env module",
    claim: "OBS-TRACKER credits a tracker configured through the repository's env accessor",
    run: () => {
      const dir = monorepoAdopter();
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      pkg.dependencies = { express: "4", "@opentelemetry/sdk-node": "0.5" };
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
      writeFileSync(
        join(dir, "apps/web/instrumentation.ts"),
        'export const url = serverEnv("OTEL_EXPORTER_OTLP_ENDPOINT");\n',
      );
      git(dir, "add", "-A");
      const f = runCatalog(buildContext(dir), RULES).find((r) => r.id === "OBS-TRACKER");
      assert.equal(f?.status, "present", f?.evidence);
    },
  },
  {
    report: "monorepo · 2026-10-02 · rc.10, route folders read as glob syntax",
    claim: "a document citing a Next route folder is not put behind by a change beside that folder",
    run: () => {
      const dir = monorepoAdopter();
      const route = "apps/web/app/(app)/[siteSlug]";
      mkdirSync(join(dir, route, "haccp"), { recursive: true });
      mkdirSync(join(dir, route, "team"), { recursive: true });
      writeFileSync(join(dir, route, "haccp/page.tsx"), "export default 1;\n");
      writeFileSync(join(dir, route, "team/page.tsx"), "export default 1;\n");
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(
        join(dir, "docs/haccp.md"),
        `---\ntitle: "H"\ndescription: "D"\ncategory: reference\nstatus: living\nlast_verified: "2020-01-01"\nsource_truth:\n  - "${route}/haccp/**/*.tsx"\n---\n\n# H\n`,
      );
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "docs: haccp");
      writeFileSync(join(dir, route, "team/page.tsx"), "export default 2;\n");
      git(dir, "commit", "-qam", "feat: team");
      const probe = BUILTIN_PROBES.find((p) => p.metric === "docs.behindCode");
      const r = probe?.scan(buildContext(dir), SCAN);
      assert.equal(r?.findings.length, 0, JSON.stringify(r?.findings));
    },
  },
  {
    report: "design · 2026-10-03 · rc.1 first contact, no package.json",
    claim: "a design repository with no package is the docs preset, and prove runs on it unasked",
    run: () => {
      const dir = designAdopter();
      const r = cli(["prove", dir], dir);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /prove · Documents/);
      assert.doesNotMatch(r.out, /no preset/);
    },
  },
  {
    report: "design · 2026-10-03 · rc.1 first contact, a noon anchor and Date.UTC",
    claim: "valid.utcDay reads the day of an instant built at local noon or with Date.UTC as safe",
    run: () => {
      const dir = designAdopter();
      const probe = BUILTIN_PROBES.find((p) => p.metric === "valid.utcDay");
      const r = probe?.scan(buildContext(dir), SCAN);
      assert.deepEqual(
        r?.findings.map((f) => f.path),
        ["mockups/js/150-series.js"],
        "only the bare instant",
      );
    },
  },
  {
    report: "design · 2026-10-03 · rc.1 first contact, the baseline refused",
    claim: "a first baseline with HARD debt already there is written, the debt held as a ratchet",
    run: () => {
      const dir = designAdopter();
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "design", private: true }));
      const r = cli(["baseline", dir, "--stack", "docs"], dir);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /baseline written/);
      assert.match(r.out, /held as a ratchet/);
    },
  },
  {
    report: "design · 2026-10-03 · rc.2 first reading, no package.json",
    claim: "a repository with no audit to run is not told first thing to fix one",
    run: () => {
      const dir = designAdopter();
      assert.doesNotMatch(cli(["status", dir, "--plain"], dir).out, /the audit has not run here/);
      // The other direction: a package with no pipeline still is.
      const pkg = tempRepo("adopter-audit-pkg", {
        "package.json": JSON.stringify({ name: "p", private: true }),
      });
      assert.match(cli(["status", pkg, "--plain"], pkg).out, /the audit has not run here/);
    },
  },
  {
    report: "product · 2026-10-03 · rc.2 upgrade, testTamper enabled",
    claim: "update carries a range probe's floor to its new definition, so the gate is not refused",
    run: () => {
      const dir = tempRepo("adopter-tamper", {
        "package.json": JSON.stringify({ name: "p", private: true }),
        "abatty.config.json": JSON.stringify({ ratchet: { enable: ["change.testTamper"] } }),
        "src/a.mjs": "export const a = 1;\n",
      });
      assert.equal(cli(["baseline", dir], dir).code, 0);
      const rel = join(dir, "scripts/ci/standards-baseline.json");
      const b = JSON.parse(readFileSync(rel, "utf8"));
      // Written under definition 1, as the adopter's was.
      b.metrics["change.testTamper"] = 0;
      b.versions = { ...(b.versions || {}), "change.testTamper": 1 };
      writeFileSync(rel, JSON.stringify(b, null, 2));
      const up = cli(["update", dir], dir);
      const after = JSON.parse(readFileSync(rel, "utf8"));
      assert.notEqual(after.versions["change.testTamper"], 1, up.out);
      assert.equal(after.metrics["change.testTamper"], 0, "carried, not raised");
      // The other direction: a floor already under the current definition is left alone.
      assert.doesNotMatch(cli(["update", dir], dir).out, /change\.testTamper/);
    },
  },
  {
    report: "monorepo · 2026-10-03 · rc.2 doctor, bun and k6",
    claim: "a runtime's own module is not a package to add; an undeclared package still is",
    run: () => {
      const dir = tempRepo("adopter-runtime", {
        "package.json": JSON.stringify({ name: "m", private: true }),
        "src/server.ts": 'import { serve } from "bun";\nimport { test } from "bun:test";\n',
        "load/smoke.js": 'import http from "k6/http";\nimport { sleep } from "k6";\n',
        "src/other.ts": 'import x from "left-pad";\n',
      });
      assert.deepEqual(
        undeclaredImports(dir).map((u) => u.name),
        ["left-pad"],
      );
    },
  },
  {
    report: "monorepo · 2026-10-03 · rc.2 replay, bun",
    claim: "update names a range on a prerelease pin, which never reaches the next minor",
    run: () => {
      const pinned = (/** @type {string} */ spec) =>
        tempRepo("adopter-pin", {
          "package.json": JSON.stringify({ name: "m", devDependencies: { abatty: spec } }),
        });
      const caret = pinned("^0.7.0-rc.12");
      const r = cli(["update", caret, "--dry-run"], caret);
      assert.match(r.out, /pins abatty at \^0\.7\.0-rc\.12: a range on a prerelease/, r.out);
      for (const spec of ["0.8.0-rc.2", "^0.6.1"]) {
        const dir = pinned(spec);
        assert.doesNotMatch(cli(["update", dir, "--dry-run"], dir).out, /a range on a prerelease/);
      }
    },
  },
];

/** A design-stage repository as the design adopter's is: documents, a mockup's scripts, no package. */
function designAdopter() {
  return tempRepo("adopter-design", {
    "docs/a.md": "---\ntitle: A\ndescription: D\ncategory: reference\nstatus: living\n---\n\n# A\n",
    "mockups/js/177-echeance.js":
      "const echeance = d => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + 1); return x.toISOString()" +
      ".slice(0, 10); };\n",
    "mockups/js/026-revue.js":
      "const mois = x => new Date(Date.UTC(x.getFullYear(), x.getMonth() + 1, 15)).toISOString()" +
      ".slice(0, 10);\n",
    "mockups/js/150-series.js":
      "const garantie = d => { const x = new Date(d); x.setMonth(x.getMonth() + 24); return x.toISOString()" +
      ".slice(0, 10); };\n",
  });
}

for (const c of CASES) test(`${c.report}: ${c.claim}`, c.run);
