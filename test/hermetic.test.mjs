import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";
import { suiteDatabase } from "../src/core/hermetic.mjs";

// The database a suite may touch is decided by facts handed in here, never by the shell the
// suite runs in: a developer's own DATABASE_URL would otherwise decide these cases.

/** A repository whose working tree touches the database suite's paths. @param {string} name @param {Record<string, string>} [extra] */
function touched(name, extra = {}) {
  const dir = tempRepo(name, {
    "package.json": JSON.stringify({
      name: "h",
      scripts: {
        test: "true",
        typecheck: "true",
        standards: "true",
        "test:rls": "true",
        coverage: "true",
      },
    }),
    "package-lock.json": "{}\n",
    ...extra,
  });
  mkdirSync(join(dir, "src", "db"), { recursive: true });
  writeFileSync(join(dir, "src", "db", "schema.ts"), "export const t = 1;\n");
  return dir;
}

/** The gate over `dir` with the database facts given; which suite scripts ran, with what env. */
function gate(
  /** @type {string} */ dir,
  /** @type {{ url: string, test: string }} */ db,
  ci = false,
) {
  /** @type {[string, Record<string, string> | undefined][]} */
  const calls = [];
  const preset = presetById("next");
  assert.ok(preset);
  const r = runGate({
    repoDir: dir,
    preset,
    run: (_d, script, _a, env) => {
      calls.push([script, env]);
      return 0;
    },
    audit: () => ({ status: 0, output: "" }),
    dockerUp: () => true,
    db,
    ci,
    log: () => {},
  });
  const suite = r.events.find((e) => /database suite/.test(e.label));
  return { r, suite, ran: calls.filter(([s]) => s === "test:rls" || s === "coverage") };
}

test("a database suite never runs against a DATABASE_URL the run did not create", () => {
  // declared in .env, the laptop's case: deferred, and nothing of the suite ran
  const inDotenv = gate(touched("herm-dotenv", { ".env": "DATABASE_URL=postgres://live/app\n" }), {
    url: "",
    test: "",
  });
  assert.equal(inDotenv.suite?.outcome, "deferred");
  assert.match(inDotenv.suite?.detail || "", /not hermetic: DATABASE_URL is declared in .*\.env/);
  assert.deepEqual(inDotenv.ran, []);
  assert.equal(inDotenv.r.ok, true, "deferred to CI, not red on somebody else's data");
  // set in the shell
  const inShell = gate(touched("herm-shell"), { url: "postgres://live/app", test: "" });
  assert.match(inShell.suite?.detail || "", /set in this shell/);
  assert.deepEqual(inShell.ran, []);
});

test("a throwaway database runs the suite, pointed at by DATABASE_URL; CI's own service is trusted", () => {
  const own = gate(touched("herm-test", { ".env": "DATABASE_URL=postgres://live/app\n" }), {
    url: "postgres://live/app",
    test: "postgres://localhost:5499/e2e",
  });
  assert.deepEqual(
    own.ran.map(([s, env]) => [s, env?.DATABASE_URL]),
    [
      ["test:rls", "postgres://localhost:5499/e2e"],
      ["coverage", "postgres://localhost:5499/e2e"],
    ],
  );
  const ci = gate(touched("herm-ci"), { url: "postgres://service/test", test: "" }, true);
  assert.deepEqual(
    ci.ran.map(([s]) => s),
    ["test:rls", "coverage"],
  );
  // and a repository that names no database at all runs its suite as before
  const none = gate(touched("herm-none"), { url: "", test: "" });
  assert.equal(none.ran.length, 2);
});

test("a dotenv file is read for the name only, and a commented-out line declares nothing", () => {
  const dir = tempRepo("herm-names", {
    ".env.local": "# DATABASE_URL=postgres://old\nOTHER_DATABASE_URL=x\n",
  });
  assert.equal(suiteDatabase([dir], { db: { url: "", test: "" } }).ok, true);
  writeFileSync(join(dir, ".env.local"), "export DATABASE_URL=postgres://x\n");
  assert.equal(suiteDatabase([dir], { db: { url: "", test: "" } }).ok, false);
});

test("every step, not only the suites, runs with the run's own database when one is named", () => {
  /** @param {{ url: string, test: string }} db */
  const typecheckEnv = (db) => {
    /** @type {Record<string, Record<string, string> | undefined>} */
    const env = {};
    runGate({
      repoDir: touched("herm-steps"),
      preset: /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next")),
      run: (_d, script, _a, e) => {
        env[script] = e;
        return 0;
      },
      audit: () => ({ status: 0, output: "" }),
      dockerUp: () => true,
      db,
      log: () => {},
    });
    return env.typecheck;
  };
  const named = typecheckEnv({ url: "postgres://live/app", test: "postgres://throwaway/t" });
  assert.equal(named?.DATABASE_URL, "postgres://throwaway/t", "a tool reading it loads its config");
  const none = typecheckEnv({ url: "postgres://live/app", test: "" });
  assert.equal(none?.DATABASE_URL, undefined, "the ambient one is never handed on");
});

test("an inherited NODE_ENV other than test or development is named before the first step", () => {
  /** @param {string} nodeEnv */
  const header = (nodeEnv) => {
    /** @type {string[]} */
    const lines = [];
    runGate({
      repoDir: touched("herm-node-env"),
      preset: /** @type {import("../src/presets/index.mjs").Preset} */ (presetById("next")),
      run: () => 0,
      audit: () => ({ status: 0, output: "" }),
      dockerUp: () => true,
      db: { url: "", test: "" },
      nodeEnv,
      log: (l) => lines.push(l),
    });
    return lines.join("\n");
  };
  assert.match(header("production"), /NODE_ENV=production is inherited/);
  assert.doesNotMatch(header(""), /NODE_ENV=/);
});
