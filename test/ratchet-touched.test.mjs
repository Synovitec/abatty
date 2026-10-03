import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, git, tempRepo } from "./helpers.mjs";

// The ratchet listed every finding in a file the push touched with a red cross, the debt the file
// already carried within its floor included, and an adopter's session read a push that had gone
// through as refused. A cross is for what fails the run.

const ESCAPED = "export const x: any = 1;\n";

test("a touched file's standing debt within its floor is listed without a cross; a regression keeps one", () => {
  const dir = tempRepo("ratchet-touched", {
    "package.json": JSON.stringify({ name: "t", version: "0.1.0" }),
    "src/a.ts": ESCAPED,
  });
  assert.equal(cli(["baseline", dir], dir).code, 0);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "baseline");
  writeFileSync(join(dir, "src/a.ts"), `${ESCAPED}// a note\n`);
  git(dir, "commit", "-qam", "touch a\n\nno-changelog: a fixture");
  const held = cli(["ratchet", dir, "--range", "HEAD~1..HEAD"], dir);
  assert.equal(held.code, 0, held.out);
  const line = held.out.split("\n").find((l) => /types\.escapes\s+src\/a\.ts/.test(l)) || "";
  assert.ok(line, held.out);
  assert.doesNotMatch(line, /✗/, "debt the file carried, within the floor, is not a failure");
  assert.match(held.out, /1 within the floor \(not failing\)/);
  writeFileSync(
    join(dir, "src/a.ts"),
    `${readFileSync(join(dir, "src/a.ts"), "utf8")}${ESCAPED.replace("x", "y")}`,
  );
  git(dir, "commit", "-qam", "worse\n\nno-changelog: a fixture");
  const worse = cli(["ratchet", dir, "--range", "HEAD~1..HEAD"], dir);
  assert.notEqual(worse.code, 0);
  const red = worse.out.split("\n").filter((l) => /^\s{4}\S+ types\.escapes\s+src\/a\.ts/.test(l));
  assert.ok(red.length && red.every((l) => l.includes("✗")), worse.out);
});

test("a file edited and not committed is touched: a run failing on it never says the change touched nothing", () => {
  const dir = tempRepo("ratchet-pending", {
    "package.json": JSON.stringify({ name: "t", version: "0.1.0" }),
    "src/a.ts": ESCAPED,
    "docs/x.md": "# x\n",
  });
  assert.equal(cli(["baseline", dir], dir).code, 0);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "baseline");
  writeFileSync(join(dir, "docs/x.md"), "# x\n\nmore\n");
  git(dir, "commit", "-qam", "docs\n\nno-changelog: a fixture");
  writeFileSync(join(dir, "src/a.ts"), `${ESCAPED}${ESCAPED.replace("x", "y")}`);
  const red = cli(["ratchet", dir, "--range", "HEAD~1..HEAD"], dir);
  assert.notEqual(red.code, 0, red.out);
  assert.doesNotMatch(red.out, /nothing this change touched/);
  assert.ok(
    red.out.split("\n").some((l) => /✗ types\.escapes\s+src\/a\.ts/.test(l)),
    red.out,
  );
});
