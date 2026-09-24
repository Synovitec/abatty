import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { git, tempRepo } from "./helpers.mjs";
import { BUILTIN_PROBES, DEFAULT_CONFIG, measureAll } from "../src/ratchet/index.mjs";
import { buildContext } from "../src/rules/context.mjs";

// A shallow clone's one commit adds every file, so it read as the last change of every document
// and every source: all fresh, and a floor above zero failed as unlocked in a one-commit checkout.

const probe = BUILTIN_PROBES.filter((p) => p.metric === "docs.behindCode");
const DOC = (/** @type {string} */ date) =>
  `---\ntitle: "T"\ndescription: "D"\nstatus: living\nlast_verified: "${date}"\nsource_truth:\n  - "src/x.ts"\n---\n# T\n`;

test("a shallow clone is not judged for freshness, and says why", () => {
  const origin = tempRepo("fresh-origin", {
    "docs/a.md": DOC("2020-01-01"),
    "src/x.ts": "export {};\n",
  });
  writeFileSync(join(origin, "src/x.ts"), "export const later = 1;\n");
  git(origin, "commit", "-qam", "feat: later");
  const deep = measureAll(
    probe,
    buildContext(origin),
    { config: DEFAULT_CONFIG, range: "" },
    null,
  )[0];
  assert.equal(deep?.value, 1, "the full history sees the doc behind");
  const shallow = join(mkdtempSync(join(tmpdir(), "abatty-shallow-")), "clone");
  git(tmpdir(), "clone", "-q", "--depth", "1", pathToFileURL(origin).href, shallow);
  const m = measureAll(
    probe,
    buildContext(shallow),
    { config: DEFAULT_CONFIG, range: "" },
    null,
  )[0];
  assert.match(m?.skipped || "", /shallow clone/);
});
