import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cli, git, tempRepo } from "./helpers.mjs";
import {
  FORBIDDEN,
  REQUIRED_PATHS,
  TERMS,
  onlyRequiredPaths,
  sampleTrailer,
} from "../src/core/vocabulary.mjs";
import { DEFAULT_MAP } from "../src/core/scrub-map.mjs";
import { fixFiles, scanCommits, scanFiles } from "../src/core/scrub.mjs";

/** A forbidden word, assembled at runtime so this file carries none. */
const tool = [..."edualc"].reverse().join("");
const maker = [..."ciporhtna"].reverse().join("");
const twoLetters = [..."I^A"].reverse().join("").replace("^", "");

test("the vocabulary decodes to the terms and does not name them itself", () => {
  assert.equal(TERMS.length, 11);
  assert.ok(FORBIDDEN.test(`the ${tool} tool`));
  assert.ok(FORBIDDEN.test(`by ${maker}`));
  assert.ok(FORBIDDEN.test(`an ${twoLetters} feature`), "the two-letter word as a word");
  assert.ok(!FORBIDDEN.test("the AIR score and a repair"), "not inside another word");
  assert.ok(FORBIDDEN.test(sampleTrailer()));
  for (const f of [
    "src/core/vocabulary.mjs",
    "src/core/scrub-map.mjs",
    "templates/harness/hooks/vocabulary.mjs",
  ]) {
    assert.ok(!FORBIDDEN.test(readFileSync(f, "utf8")), `${f} names a term`);
  }
});

test("the hooks carry the same vocabulary as the package", () => {
  const a = readFileSync("src/core/vocabulary.mjs", "utf8").replace(/^ \*.*$/gm, "");
  const b = readFileSync("templates/harness/hooks/vocabulary.mjs", "utf8").replace(/^ \*.*$/gm, "");
  assert.equal(a, b, "the two files differ outside their header comments");
});

test("a line that mentions only the agent's required paths is not a finding", () => {
  assert.ok(
    onlyRequiredPaths(`restore ${REQUIRED_PATHS[0]}adoption.json and ${REQUIRED_PATHS[3]}`),
  );
  assert.ok(!onlyRequiredPaths(`${REQUIRED_PATHS[0]} written by ${tool}`));
});

test("scanFiles finds a planted term and skips the allow-list; fixFiles rewrites it and keeps the paths", () => {
  const dir = tempRepo("scrub", {
    "package.json": '{"name":"x"}\n',
    "docs/note.md": `The ${tool} tool wrote this under ${REQUIRED_PATHS[0]}hooks.\n`,
    "src/feature/assistant-thing.ts": `export const label = "${twoLetters} assistant";\n`,
  });
  const found = scanFiles(dir);
  assert.deepEqual(found.map((f) => f.where).sort(), [
    "docs/note.md",
    "src/feature/assistant-thing.ts",
  ]);
  const allowed = scanFiles(dir, { allow: ["src/feature/"] });
  assert.deepEqual(
    allowed.map((f) => f.where),
    ["docs/note.md"],
  );
  const changed = fixFiles(dir, DEFAULT_MAP);
  assert.ok(changed.includes("docs/note.md"));
  const after = readFileSync(join(dir, "docs/note.md"), "utf8");
  assert.equal(after, `The agent tool wrote this under ${REQUIRED_PATHS[0]}hooks.\n`);
  assert.equal(scanFiles(dir, { allow: ["src/feature/"] }).length, 0);
});

test("scanCommits finds a planted commit message", () => {
  const dir = tempRepo("scrub-commits", { "package.json": '{"name":"x"}\n' });
  writeFileSync(join(dir, "a.txt"), "a\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", `feat: a\n\n${sampleTrailer()}`);
  const found = scanCommits(dir);
  assert.equal(found.length, 1);
  assert.match(found[0]?.text || "", /noreply@example\.com/);
  assert.equal(scanCommits(dir, "HEAD~1..HEAD~1").length, 0);
});

test("the scrub is opt-in: --message is a no-op where the repository did not opt in, and refuses the trailer where it did", () => {
  const msg = join(tmpdir(), `abatty-msg-${Date.now()}.txt`);
  writeFileSync(msg, `feat: x\n\n${sampleTrailer()}\n`);
  const off = tempRepo("scrub-off", { "package.json": "{}" });
  assert.equal(cli(["scrub", off, "--message", msg], off).code, 0, "provenance is the default");
  const on = tempRepo("scrub-on", {
    "package.json": "{}",
    "abatty.config.json": JSON.stringify({ scrub: { enabled: true } }),
  });
  const r = cli(["scrub", on, "--message", msg], on);
  assert.equal(r.code, 3);
  assert.match(r.out, /commit message names a tool/);
  const scan = cli(["scrub", off], off);
  assert.match(scan.out, /off in this repository \(scrub\.enabled\)/);
});
