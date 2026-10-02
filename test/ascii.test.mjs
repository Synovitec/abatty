import { test } from "node:test";
import assert from "node:assert/strict";
import { cli, tempRepo } from "./helpers.mjs";
import { asciiOnly, toAscii } from "../src/ui/term.mjs";

// abatty writes UTF-8, and a classic Windows console decodes it in its OEM code page: an adopter
// read "Ô£ù gate red ┬À 1 step(s)". Where the console cannot show it, the symbols go ASCII.

test("a classic Windows console gets ASCII; the terminals that show UTF-8 keep the symbols", () => {
  assert.equal(asciiOnly({}, "win32"), true, "PowerShell 5.1 or cmd, nothing else said");
  for (const env of [
    { WT_SESSION: "1" },
    { TERM_PROGRAM: "vscode" },
    { MSYSTEM: "MINGW64" },
    { CI: "true" },
  ])
    assert.equal(asciiOnly(env, "win32"), false, JSON.stringify(env));
  assert.equal(asciiOnly({}, "linux"), false);
  assert.equal(asciiOnly({ ABATTY_ASCII: "1" }, "linux"), true, "asked for");
  assert.equal(asciiOnly({ ABATTY_ASCII: "0" }, "win32"), false, "refused");
});

test("abatty's symbols are written in ASCII, and nothing else is touched", () => {
  assert.equal(toAscii("✗ gate red · 1 step(s) → ██░░"), "x gate red - 1 step(s) -> ##..");
  assert.equal(toAscii("café.ts"), "café.ts");
});

test("asked for ASCII, a screen carries none of the symbols", () => {
  const dir = tempRepo("ascii", { "package.json": "{}" });
  const r = cli(["status", dir], dir, { ABATTY_ASCII: "1" });
  assert.doesNotMatch(r.out, /[·✓✗▶█░▒─]/u, r.out);
  assert.match(r.out, / - /);
});
