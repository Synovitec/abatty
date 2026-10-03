import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRepo } from "./helpers.mjs";
import { explainFailure } from "../src/core/flake.mjs";
import { staleTypesHint } from "../src/core/stale-types.mjs";

// A Next adopter switched branches and the typecheck went red on routes that only the other
// branch has, in types Next had generated: nearly four minutes of gate read as their own error.

const STALE =
  ".next/types/validator.ts(12,3): error TS2307: Cannot find module '../../app/billing/page.js' or its corresponding type declarations.\n";
const OWN =
  "src/app/page.tsx(4,7): error TS2322: Type 'string' is not assignable to type 'number'.\n";

test("errors in Next's generated types are named, with how to rebuild them; the code's own are not", () => {
  assert.match(staleTypesHint(STALE).join("\n"), /Next's generated types.*next typegen/);
  assert.match(
    staleTypesHint(".next/dev/types/routes.d.ts(1,1): error TS2344: x\n").join(""),
    /generated/,
  );
  assert.deepEqual(staleTypesHint(OWN), []);
});

test("a failed step's explanation leads with it", () => {
  const dir = tempRepo("stale-types", { "package.json": JSON.stringify({ name: "w" }) });
  const log = join(dir, "typecheck.log");
  writeFileSync(log, OWN + STALE);
  const lines = explainFailure({ repoDir: dir, log, changed: [], head: "" });
  assert.match(String(lines[0]), /Next's generated types/);
});
