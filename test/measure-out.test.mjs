import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cli, tempRepo } from "./helpers.mjs";

// An adopter ran `measure --json --out <file> --quiet` to keep one measurement aside: the JSON
// went to the screen, no file was written, and the repository's latest report, which a dashboard
// and the MCP server read as the truth, was replaced by the run.

test("measure --out writes the measurement there and only there", () => {
  const dir = tempRepo("measure-out", { "package.json": JSON.stringify({ name: "m" }) });
  const latest = join(dir, ".abatty/reports/latest.json");
  const r = cli(["measure", dir, "--json", "--out", "out/m.json", "--quiet"], dir);
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(readFileSync(join(dir, "out/m.json"), "utf8")).name, "m");
  assert.doesNotMatch(r.out, /"findings"/, "not on the screen");
  assert.equal(existsSync(latest), false, "the latest report is left alone");
  const plain = cli(["measure", dir, "--json"], dir);
  assert.match(plain.out, /"findings"/, "without --out the JSON is on the screen");
  assert.equal(existsSync(latest), true, "and the run is recorded as the latest");
});

test("measure --out names only the file it wrote, never a JSON path it did not", () => {
  const dir = tempRepo("measure-out-md", { "package.json": JSON.stringify({ name: "m" }) });
  const r = cli(["measure", dir, "--out", "out/gap.md", "--plain"], dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /report: out\/gap\.md/);
  assert.doesNotMatch(r.out, /JSON: \.abatty\/reports\//);
  assert.equal(existsSync(join(dir, ".abatty/reports")), false, "no JSON was written");
  const plain = cli(["measure", dir, "--plain"], dir);
  const named = plain.out.match(/JSON: (\.abatty\/reports\/\S+\.json)/);
  assert.ok(
    named && existsSync(join(dir, String(named[1]))),
    "without --out the named JSON exists",
  );
});
