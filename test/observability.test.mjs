import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";

/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);
/** @param {string} name @param {Record<string,string>} files */
const read = (name, files) => runCatalog(buildContext(tempRepo(name, files)), RULES);

const PKG = (/** @type {Record<string,string>} */ deps = {}) =>
  JSON.stringify({ name: "svc", private: true, dependencies: { express: "4", ...deps } });

test("every observability rule is n/a where nothing receives traffic or a signal", () => {
  // A library and a browser application have no health endpoint and no SIGTERM. The finding is
  // n/a with the reason, never missing: that distinction is the whole of the applies mechanism.
  const f = read("obs-na", {
    "package.json": JSON.stringify({ name: "lib", private: true }),
    "src/index.mjs": "export const x = 1;\n",
  });
  for (const id of [
    "OBS-STRUCTURED",
    "OBS-REDACTION",
    "OBS-CONSOLE",
    "OBS-SIGTERM",
    "OBS-HEALTH",
    "OBS-TRACKER",
  ]) {
    assert.equal(of(f, id).status, "n/a", id);
    assert.match(of(f, id).evidence, /no server/, id);
  }
});

test("a service with none of it: every rule missing, and each says what it looked for", () => {
  const f = read("obs-bare", {
    "package.json": PKG(),
    "server/app.js": "const app = require('express')();\napp.get('/', (_q, r) => r.end());\n",
  });
  assert.equal(of(f, "OBS-STRUCTURED").status, "missing");
  assert.match(of(f, "OBS-STRUCTURED").evidence, /no logging dependency/);
  assert.equal(of(f, "OBS-REDACTION").status, "missing");
  assert.equal(of(f, "OBS-CONSOLE").status, "missing");
  assert.match(of(f, "OBS-CONSOLE").evidence, /not in the lint configuration/);
  assert.equal(of(f, "OBS-SIGTERM").status, "missing");
  assert.equal(of(f, "OBS-HEALTH").status, "missing");
  assert.equal(of(f, "OBS-TRACKER").status, "missing");
});

test("a service with all of it: every rule present", () => {
  const f = read("obs-full", {
    "package.json": PKG({ pino: "9", "@sentry/node": "8" }),
    "eslint.config.mjs": 'export default [{ rules: { "no-console": "error" } }];\n',
    "server/app.js": `
const pino = require("pino");
const logger = pino({ redact: ["password", "token", "authorization", "email", "iban"] });
require("@sentry/node").init({ dsn: process.env.SENTRY_DSN });
const app = require("express")();
app.get("/healthz", (_q, r) => r.end("ok"));
process.on("SIGTERM", async () => {
  ready = false;
  await server.close();
  await drain();
  process.exit(0);
});
`,
  });
  for (const id of [
    "OBS-STRUCTURED",
    "OBS-REDACTION",
    "OBS-CONSOLE",
    "OBS-SIGTERM",
    "OBS-HEALTH",
    "OBS-TRACKER",
  ])
    assert.equal(of(f, id).status, "present", `${id}: ${of(f, id).evidence}`);
});

test("the partial cases: the mechanism is there and it does not hold", () => {
  // Each of these is the failure the rule exists for, and each reads as correct to a skimmer.
  const f = read("obs-partial", {
    "package.json": PKG({ pino: "9", "@sentry/node": "8" }),
    "eslint.config.mjs": 'export default [{ rules: { "no-console": "error" } }];\n',
    "server/app.js": `
const logger = require("pino")({ redact: ["password"] });
require("@sentry/node").init({ dsn: settings.dsn });
console.log("starting");
app.get("/healthz", (_q, r) => r.end());
function mask(v) { return "***"; }
process.on("SIGTERM", () => {
  process.exit(0);
});
`,
  });
  assert.equal(of(f, "OBS-CONSOLE").status, "partial", "configured, and a call remains");
  assert.match(of(f, "OBS-CONSOLE").evidence, /console call\(s\) remain/);
  assert.equal(of(f, "OBS-SIGTERM").status, "partial", "a handler that exits without draining");
  assert.match(of(f, "OBS-SIGTERM").evidence, /without draining/);
  assert.equal(of(f, "OBS-REDACTION").status, "partial", "configured, and hand-masking remains");
  assert.equal(of(f, "OBS-TRACKER").status, "partial", "a tracker not read from the environment");
  assert.match(of(f, "OBS-TRACKER").evidence, /not read from the environment/);
});
