import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { BUILTIN_PROBES, DEFAULT_CONFIG, measureAll } from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// An adopter's valid.utcDay read 0 while 196 of these sat in its queries: the day a query takes
// is the session's, and the finding has to point at the line a reader opens.

const probe = BUILTIN_PROBES.filter((p) => p.metric === "valid.sqlCurrentDate");
const DAY = ["current", "date"].join("_");

test("the session's day inside a multi-line query is reported on its own line", () => {
  const dir = tempRepo("sqldate", {
    "src/shifts.ts": [
      "export const open = (sql, site) => sql`",
      "  select * from shift",
      "  where site = ${site}",
      `    and day = ${DAY}`,
      "`;",
      "",
    ].join("\n"),
  });
  const [m] = measureAll(
    probe,
    buildContext(dir, { tracked: true }),
    { config: DEFAULT_CONFIG, range: "" },
    null,
  );
  assert.deepEqual(
    m?.findings.map((f) => `${f.path}:${f.line}`),
    ["src/shifts.ts:4"],
  );
});
