import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { suiteEnvGaps, suiteEnvOf } from "../src/core/suite-env.mjs";

// An adopter's browser suite failed 96 journeys in a fresh checkout, "Not authenticated", because
// the server had no auth secret: CI set placeholders in its workflow, the laptop had them only in
// a .env the checkout lacked. The names the example file declares, set nowhere, are said first.

const EXAMPLE = "DATABASE_URL=\nABATTY_T_AUTH_SECRET=\nABATTY_T_AUTH_URL=\n";

test("a name the example declares and nothing sets is a gap; the database is never one", () => {
  const dir = tempRepo("suite-env", { ".env.example": EXAMPLE });
  assert.deepEqual(suiteEnvGaps([dir]), ["ABATTY_T_AUTH_SECRET", "ABATTY_T_AUTH_URL"]);
  assert.deepEqual(suiteEnvGaps([dir], { declared: { ABATTY_T_AUTH_URL: "http://localhost" } }), [
    "ABATTY_T_AUTH_SECRET",
  ]);
  writeFileSync(join(dir, ".env"), "ABATTY_T_AUTH_SECRET=local\n");
  assert.deepEqual(suiteEnvGaps([dir]), ["ABATTY_T_AUTH_URL"], "a dotenv file the framework loads");
  assert.deepEqual(suiteEnvGaps([dir], { ci: true }), [], "CI's workflow writes its environment");
});

test("the config's suiteEnv gives a suite string values, and leaves anything else out", () => {
  const dir = tempRepo("suite-env-config", {
    "abatty.config.json": JSON.stringify({ suiteEnv: { AUTH_URL: "http://localhost:3000", N: 3 } }),
  });
  assert.deepEqual(suiteEnvOf(dir), { AUTH_URL: "http://localhost:3000" });
});
