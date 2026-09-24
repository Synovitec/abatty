// The rules an adopter's repository read wrong: each case is the shape that was misread, with
// the control beside it so the fix cannot pass by reading nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { git, tempRepo } from "./helpers.mjs";
import { RULES } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { templatePlaceholders } from "../src/rules/families/documents.mjs";
import { phantomScripts } from "../src/rules/families/instrument.mjs";

/** @param {string} id @param {Record<string, string>} files */
function judge(id, files) {
  const rule = RULES.find((r) => r.id === id);
  assert.ok(rule, id);
  return rule.check(buildContext(tempRepo(id.toLowerCase(), files)));
}

const PKG = JSON.stringify({ name: "x", version: "1.0.0" });
const FROZEN_CI = "steps:\n  - run: bun install --frozen-lockfile\n";

test("SEC-LOCKFILE reads bun's lockfile, and still says missing without one", () => {
  const bun = judge("SEC-LOCKFILE", {
    "package.json": PKG,
    "bun.lock": "{}\n",
    ".github/workflows/ci.yml": FROZEN_CI,
  });
  assert.equal(bun.status, "present");
  assert.match(bun.evidence, /bun\.lock/);
  const none = judge("SEC-LOCKFILE", {
    "package.json": PKG,
    ".github/workflows/ci.yml": FROZEN_CI,
  });
  assert.equal(none.status, "missing");
});

test("INST-DEAD-CI names a second CI system only when there are two", () => {
  const gh = judge("INST-DEAD-CI", { ".github/workflows/ci.yml": "on: push\n" });
  assert.equal(gh.status, "present");
  assert.doesNotMatch(gh.evidence, /Woodpecker/);
  const both = judge("INST-DEAD-CI", {
    ".github/workflows/ci.yml": "on: push\n",
    ".woodpecker/ci.yml": "steps: []\n",
  });
  assert.equal(both.status, "partial");
  assert.equal(judge("INST-DEAD-CI", { "a.txt": "x" }).status, "n/a");
});

test("DATA-TENANT counts a test named rls wherever it sits, and a scope test only in a DB suite", () => {
  const migration = { "packages/db/migrations/001.sql": "CREATE TABLE t (tenant_id uuid);\n" };
  const rls = judge("DATA-TENANT", {
    ...migration,
    "packages/db/src/orders.rls.test.ts": "test('a', () => {});\n",
  });
  assert.equal(rls.status, "present");
  assert.match(rls.evidence, /isolation test present/);
  const scope = judge("DATA-TENANT", {
    ...migration,
    "src/scope.test.ts": "test('a', () => {});\n",
  });
  assert.equal(scope.status, "partial", "a scope test outside a database suite is not the proof");
  for (const lookalike of ["src/lib/urls.test.ts", "src/components/TenantPicker.test.tsx"])
    assert.equal(
      judge("DATA-TENANT", { ...migration, [lookalike]: "test('a', () => {});\n" }).status,
      "partial",
      `${lookalike} is not an isolation test`,
    );
});

test("TEST-UNIT names the runner the test script runs before a dependency one app carries", () => {
  const v = judge("TEST-UNIT", {
    "package.json": JSON.stringify({
      scripts: { test: "bun test" },
      devDependencies: { jest: "1" },
    }),
    "src/a.test.ts": "test('a', () => {});\n",
    "src/a.ts": "export const a = 1;\n",
  });
  assert.equal(v.status, "present");
  assert.match(v.evidence, /^bun test,/);
  const jest = judge("TEST-UNIT", {
    "package.json": JSON.stringify({ scripts: { test: "tsc" }, devDependencies: { jest: "1" } }),
    "src/a.test.ts": "test('a', () => {});\n",
    "src/a.ts": "export const a = 1;\n",
  });
  assert.match(jest.evidence, /^jest,/);
});

test("OBS-REDACTION reads a logger module at any depth, and a route file is not one", () => {
  const nested = judge("OBS-REDACTION", {
    "apps/web/lib/observability/logger.ts": "export const log = pino({ redact: ['password'] });\n",
  });
  assert.equal(nested.status, "present");
  const elsewhere = judge("OBS-REDACTION", {
    "apps/web/lib/util/format.ts": "export const log = pino({ redact: ['password'] });\n",
  });
  assert.equal(elsewhere.status, "missing");
});

test("OBS-HEALTH names the endpoint itself, not the first sub-route in file order", () => {
  const v = judge("OBS-HEALTH", {
    "app/api/health/email/route.ts": "export const GET = () => 1;\n",
    "app/api/health/route.ts": "export const GET = () => 1;\n",
  });
  assert.equal(v.evidence, "app/api/health/route.ts");
});

test("a placeholder inside code is an example, and one in prose is still a blank", () => {
  assert.deepEqual(templatePlaceholders("Write `-- <which case>` above it."), []);
  assert.deepEqual(templatePlaceholders("```sql\n-- <which case>\n```\n"), []);
  assert.deepEqual(templatePlaceholders("Name: <project name>"), ["<project name>"]);
  assert.deepEqual(templatePlaceholders("SemVer in `<package.json | docs/version.json>`."), [
    "<package.json | docs/version.json>",
  ]);
});

test("HARNESS-HOOKS lists every wired event, PostToolUse included", () => {
  const settings = {
    hooks: {
      PostToolUse: [{ hooks: [{ type: "command", command: "node x.mjs" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node y.mjs" }] }],
    },
  };
  const v = judge("HARNESS-HOOKS", { ".claude/settings.json": JSON.stringify(settings) });
  assert.match(v.evidence, /wired: PostToolUse, Stop/);
});

test("HARNESS-GITIGNORE asks for .abatty/ whether or not a night is configured", () => {
  const bare = judge("HARNESS-GITIGNORE", { ".gitignore": "node_modules/\n" });
  assert.equal(bare.status, "missing");
  assert.match(bare.evidence, /\.abatty\//);
  assert.equal(judge("HARNESS-GITIGNORE", { ".gitignore": "/.abatty\n" }).status, "present");
  const night = judge("HARNESS-GITIGNORE", {
    ".gitignore": ".abatty/\n",
    ".claude/adoption.json": "{}",
  });
  assert.equal(night.status, "partial");
  assert.match(night.evidence, /\.claude\/night\//);
});

test("SEC-AGENT-SHIM counts the shim only where something puts it on PATH", () => {
  const shim = { ".claude/bin/git": "#!/bin/sh\n", ".claude/bin/shim.mjs": "export {};\n" };
  const inert = judge("SEC-AGENT-SHIM", shim);
  assert.equal(inert.status, "partial");
  assert.match(inert.evidence, /nothing puts/);
  const envrc = judge("SEC-AGENT-SHIM", { ...shim, ".envrc": "PATH_add .claude/bin\n" });
  assert.equal(envrc.status, "present");
  const night = judge("SEC-AGENT-SHIM", { ...shim, ".claude/night/.keep": "" });
  assert.equal(night.status, "present");
  assert.match(night.evidence, /night/);
});

test("FLOW-EMDASH steps aside where the repository's typography uses the dash", () => {
  const dash = String.fromCharCode(0x2014);
  const copy = { "README.md": `Bonjour ${dash} le monde\n` };
  assert.equal(judge("FLOW-EMDASH", copy).status, "partial");
  const allowed = judge("FLOW-EMDASH", {
    ...copy,
    "abatty.config.json": JSON.stringify({ style: { emDash: "allowed" } }),
  });
  assert.equal(allowed.status, "n/a");
});

test("FLOW-TRAILER reads kept provenance as a practised policy, and n/a without trailers", () => {
  const trailer = [..."yB-derohtuA-oC"].reverse().join("");
  const dir = tempRepo("trailer-kept", { "a.txt": "x" });
  git(dir, "commit", "-q", "--allow-empty", "-m", `feat: a\n\n${trailer}: A <a@example.com>`);
  const rule = RULES.find((r) => r.id === "FLOW-TRAILER");
  assert.ok(rule);
  const kept = rule.check(buildContext(dir));
  assert.equal(kept.status, "present");
  assert.match(kept.evidence, /provenance kept: 1 trailer/);
  assert.equal(judge("FLOW-TRAILER", { "a.txt": "x" }).status, "n/a");
});

test("INST-CI credits a step that runs a workspace's script in the workspace's folder", () => {
  const ci = [
    "jobs:",
    "  web:",
    "    defaults: { run: { working-directory: apps/web } }",
    "    steps:",
    "      - run: bun run typecheck",
    "      - run: pnpm --filter web run lint",
    "      - run: bun run nowhere",
  ].join("\n");
  const v = judge("INST-CI", {
    "package.json": JSON.stringify({ scripts: { test: "bun test" } }),
    "apps/web/package.json": JSON.stringify({ scripts: { typecheck: "tsc", lint: "biome" } }),
    ".github/workflows/ci.yml": ci,
  });
  assert.equal(v.status, "partial");
  assert.match(v.evidence, /does not have: nowhere$/);
  // a workspace the pipeline never names lends a root step nothing
  const unnamed = judge("INST-CI", {
    "package.json": JSON.stringify({ scripts: { test: "npm test" } }),
    "packages/x/package.json": JSON.stringify({ name: "x-lib", scripts: { lint: "biome" } }),
    ".github/workflows/ci.yml": "steps:\n  - run: npm run lint\n",
  });
  assert.match(unnamed.evidence, /does not have: lint$/);
});

test("a flag before run is read through, and a flag's value is not the script", () => {
  assert.deepEqual(phantomScripts("pnpm --filter web run lint", {}), ["lint"]);
  assert.deepEqual(phantomScripts("bun --cwd apps/api run test", {}), ["test"]);
  assert.deepEqual(phantomScripts("pnpm -r run build", { build: "x" }), []);
});

test("HARNESS-GITIGNORE reads a folder ignored as a glob, and OBS reads no test or mock", () => {
  for (const line of [".abatty/*", "/.abatty/**", "**/.abatty/"])
    assert.equal(judge("HARNESS-GITIGNORE", { ".gitignore": `${line}\n` }).status, "present", line);
  const mocked = judge("OBS-REDACTION", {
    "src/server/logger.test.ts": "const log = pino({ redact: ['password'] });\n",
    "src/server/__mocks__/logger.ts": "export const log = pino({ redact: ['password'] });\n",
  });
  assert.equal(mocked.status, "missing");
});

test("SEC-AGENT-SHIM does not read the config's phases as a night that ran", () => {
  const v = judge("SEC-AGENT-SHIM", {
    ".claude/bin/git": "#!/bin/sh\n",
    ".claude/bin/shim.mjs": "export {};\n",
    "abatty.config.json": JSON.stringify({ phases: [0, 1, 2] }),
  });
  assert.equal(v.status, "partial");
});

test("a pipeline running a file is not naming a script, turbo hands the runner to the workspaces, and the health route beats a helper", () => {
  assert.deepEqual(
    phantomScripts(
      "bun run scripts/check-bundle-size.ts\nbun run tools/x.mjs --strict\nbun run nowhere",
      {},
    ),
    ["nowhere"],
  );
  const turbo = judge("TEST-UNIT", {
    "package.json": JSON.stringify({ scripts: { test: "turbo run test" } }),
    "apps/web/package.json": JSON.stringify({ scripts: { test: "bun test" } }),
    "apps/mobile/package.json": JSON.stringify({ devDependencies: { jest: "1" } }),
    "apps/web/src/a.test.ts": "test('a', () => {});\n",
    "apps/web/src/a.ts": "export const a = 1;\n",
  });
  assert.match(turbo.evidence, /^bun test,/);
  const health = judge("OBS-HEALTH", {
    "apps/web/lib/api/health.ts": "export const ping = () => 1;\n",
    "apps/web/app/api/health/route.ts": "export const GET = () => 1;\n",
  });
  assert.equal(health.evidence, "apps/web/app/api/health/route.ts");
});

test("INST-GATE reads a pre-push hook git records as not executable as partial", () => {
  const files = {
    "package.json": JSON.stringify({ scripts: { gate: "abatty gate" } }),
    ".githooks/pre-push": "#!/bin/sh\nnpm run -s gate -- --refs\n",
  };
  const rule = RULES.find((r) => r.id === "INST-GATE");
  assert.ok(rule);
  const dir = tempRepo("inst-gate-mode", files);
  git(dir, "update-index", "--chmod=+x", "--", ".githooks/pre-push");
  git(dir, "commit", "-q", "-m", "x");
  assert.equal(rule.check(buildContext(dir)).status, "present");
  git(dir, "update-index", "--chmod=-x", "--", ".githooks/pre-push");
  git(dir, "commit", "-q", "-m", "y");
  const v = rule.check(buildContext(dir));
  assert.equal(v.status, "partial");
  assert.match(v.evidence, /committed as not executable/);
});

test("INST-GATE does not read a husky hook or a lefthook config as an inert hook", () => {
  const rule = RULES.find((r) => r.id === "INST-GATE");
  assert.ok(rule);
  for (const hook of [".husky/pre-push", "lefthook.yml"]) {
    const dir = tempRepo("inst-gate-other", {
      "package.json": JSON.stringify({ scripts: { gate: "abatty gate" } }),
      [hook]: "npm run gate\n",
    });
    assert.equal(rule.check(buildContext(dir)).status, "present", hook);
  }
});

test("INST-CI credits a step whose own working-directory names the workspace", () => {
  const ci = [
    "jobs:",
    "  web:",
    "    steps:",
    "      - run: bun run typecheck",
    "        working-directory: apps/web",
    "      - run: bun run nowhere",
  ].join("\n");
  const v = judge("INST-CI", {
    "package.json": JSON.stringify({ scripts: { test: "bun test" } }),
    "apps/web/package.json": JSON.stringify({ scripts: { typecheck: "tsc" } }),
    ".github/workflows/ci.yml": ci,
  });
  assert.match(v.evidence, /does not have: nowhere$/);
});

test("HARNESS-HOOKS reads the adopter's own PostToolUse block: a pipe matcher and a quoted project path", () => {
  // Assembled: the variable's literal name is the agent's own, and the command is the adopter's.
  const project = [[..."EDUALC"].reverse().join(""), "PROJECT", "DIR"].join("_");
  const settings = {
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node a.mjs" }] }],
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            { type: "command", command: `node "\${${project}}/.claude/hooks/post-tool-use.mjs"` },
          ],
        },
      ],
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node g.mjs" }] }],
    },
  };
  const v = judge("HARNESS-HOOKS", { ".claude/settings.json": JSON.stringify(settings) });
  assert.match(v.evidence, /PostToolUse/);
  assert.match(v.evidence, /SessionStart/);
  assert.match(v.evidence, /PreToolUse/);
});

test("a placeholder that wraps onto a second line is still a placeholder", () => {
  // The template's longer questions wrap; read one line at a time they were never named, so an
  // adopter's context file could keep them unanswered while every check said present.
  assert.deepEqual(
    templatePlaceholders(
      "## 5\n\n<Where each credential comes from, and how\nlong a change takes.>\n",
    ),
    ["<Where each credential comes from, and how long a change takes.>"],
  );
  assert.deepEqual(templatePlaceholders("Returns <span>\nand <b>.\n"), []);
});

test("TEST-COVERAGE credits the gate's own coverage:changed step as a gate on the change", () => {
  const withStep = judge("TEST-COVERAGE", {
    "package.json": JSON.stringify({
      scripts: { "coverage:changed": "node scripts/coverage-changed.mjs" },
    }),
    "src/a.ts": "export const a = 1;\n",
  });
  assert.match(withStep.evidence, /a gate on the change/);
  const without = judge("TEST-COVERAGE", {
    "package.json": JSON.stringify({
      scripts: { coverage: "node --test --experimental-test-coverage" },
    }),
    "src/a.ts": "export const a = 1;\n",
  });
  assert.match(without.evidence, /no gate on the changed lines/);
});

test("TEST-MUTATION credits a script that runs abatty mutate, bounded by construction", () => {
  const v = judge("TEST-MUTATION", {
    "package.json": JSON.stringify({ scripts: { mutate: "abatty mutate --strict" } }),
    "src/a.ts": "export const a = 1;\n",
  });
  assert.equal(v.status, "present");
  assert.match(v.evidence, /bounded to the changed lines.*a survivor fails it/);
  const loose = judge("TEST-MUTATION", {
    "package.json": JSON.stringify({ scripts: { mutate: "abatty mutate" } }),
    "src/a.ts": "export const a = 1;\n",
  });
  assert.match(loose.evidence, /no floor: without --strict a survivor fails nothing/);
  assert.equal(
    judge("TEST-MUTATION", {
      "package.json": JSON.stringify({ scripts: {} }),
      "src/a.ts": "export const a = 1;\n",
    }).status,
    "missing",
  );
});
