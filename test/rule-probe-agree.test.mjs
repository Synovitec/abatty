import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { probes } from "../src/ratchet/probes/code.mjs";
import { resolveConfig } from "../src/ratchet/config.mjs";

// A product repository was shown two numbers for one question: TYPES-ESCAPES counted an `any` the
// ratchet's types.escapes did not, and VALID-ENV took a fixture named env for the env module and
// ignored `ratchet.envModule`. The rule now reads the probe; these hold the two together.

const ANY = ["a", "ny"].join("");
const ENV = ["process", "env"].join(".");

/** The rule's finding and the probe's count over one repository. @param {string} dir @param {string} id @param {string} metric */
function both(dir, id, metric) {
  const c = buildContext(dir);
  const finding = runCatalog(c, RULES).find((f) => f.id === id);
  const probe = probes.find((p) => p.metric === metric);
  const r = probe?.scan(c, { config: resolveConfig(c.adoption), range: "" });
  return { finding, count: r && !r.skipped ? r.findings.length : -1 };
}

test("TYPES-ESCAPES counts what types.escapes counts, not a comment in JavaScript nor an exempt script", () => {
  const dir = tempRepo("agree-escapes", {
    "package.json": JSON.stringify({ name: "p", devDependencies: { typescript: "5.0.0" } }),
    "tsconfig.json": "{}\n",
    "src/a.ts": `export const x: ${ANY} = 1;\n`,
    "src/b.ts": "export const y = 2;\n",
    "src/legacy.js": `// the old shape: ${ANY}\nexport const z = 3;\n`,
    "scripts/tool.ts": `export const t: ${ANY} = 4;\n`,
  });
  const { finding, count } = both(dir, "TYPES-ESCAPES", "types.escapes");
  assert.equal(count, 1);
  assert.match(String(finding?.evidence), /^1 any, 0 directive\(s\) \(types\.escapes: 1\)/);
});

test("VALID-ENV takes the configured env module and counts what valid.rawEnv counts", () => {
  const dir = tempRepo("agree-env", {
    "package.json": JSON.stringify({ name: "p", dependencies: { next: "15.0.0" } }),
    "abatty.config.json": JSON.stringify({
      ratchet: { envModule: "(^|/)src/settings\\.ts$" },
    }),
    "src/settings.ts": `export const s = { k: ${ENV}.KEY };\n`,
    "src/lib/env.ts": `export const e = ${ENV}.OTHER;\n`,
    "src/service.ts": `export const v = ${ENV}.V;\n`,
    "test/fixtures/env.ts": `export const f = ${ENV}.F;\n`,
  });
  const { finding, count } = both(dir, "VALID-ENV", "valid.rawEnv");
  assert.equal(count, 2, "the service and the file merely named env");
  assert.match(
    String(finding?.evidence),
    /^src\/settings\.ts; 2 raw process\.env read\(s\) elsewhere/,
  );
});

test("VALID-ENV names every env module of a monorepo, not the first one found", () => {
  // An adopter with one env module per workspace read only the first named, beside the raw reads.
  const dir = tempRepo("agree-env-many", {
    "package.json": JSON.stringify({ name: "p", dependencies: { next: "15.0.0" } }),
    "apps/web/lib/env.ts": `export const a = ${ENV}.A;\n`,
    "apps/mobile/lib/env.ts": `export const b = ${ENV}.B;\n`,
    "packages/auth/src/env.ts": `export const c = ${ENV}.C;\n`,
    "packages/crypto/src/env.ts": `export const d = ${ENV}.D;\n`,
    "packages/mail/src/env.ts": `export const e = ${ENV}.E;\n`,
  });
  const { finding } = both(dir, "VALID-ENV", "valid.rawEnv");
  const evidence = String(finding?.evidence);
  assert.match(evidence, /^5 env modules: /);
  const all = [
    "apps/web/lib/env.ts",
    "apps/mobile/lib/env.ts",
    "packages/auth/src/env.ts",
    "packages/crypto/src/env.ts",
    "packages/mail/src/env.ts",
  ];
  assert.equal(all.filter((m) => evidence.includes(m)).length, 4, "four named, the fifth counted");
  assert.match(evidence, /and 1 more; 0 raw process\.env read\(s\) elsewhere/);
});

test("VALID-ENV with no env module anywhere reads missing, as before", () => {
  const dir = tempRepo("agree-env-none", {
    "package.json": JSON.stringify({ name: "p", dependencies: { next: "15.0.0" } }),
    "src/service.ts": `export const v = ${ENV}.V;\n`,
  });
  const { finding, count } = both(dir, "VALID-ENV", "valid.rawEnv");
  assert.equal(count, 1);
  assert.equal(finding?.status, "missing");
});
