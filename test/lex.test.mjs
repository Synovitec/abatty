import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOnly } from "../src/ratchet/probes/lex.mjs";

// A quote or a backtick inside a pattern literal opened a string that ran on: the code after it
// was blanked (a raw environment read hidden) or a comment after it was read as code (one
// invented). A pattern is now a literal of its own.

const lines = (/** @type {string[]} */ l) => l.join("\n") + "\n";

test("a pattern literal holding a quote or a backtick leaves the code after it as code", () => {
  const out = codeOnly(
    lines([
      "const a = /[\"'`]x/.test(t);",
      "// a note with `quoted` words",
      'const b = process.env["X"];',
      "const r = s.replace(/'/g, x);",
    ]),
  ).split("\n");
  assert.equal(out[0], "const a = /      /.test(t);");
  assert.equal(String(out[1]).trim(), "", "the comment is blanked");
  assert.match(String(out[2]), /process\.env\[/);
  assert.equal(out[3], "const r = s.replace(/ /g, x);");
});

test("a division and a JSX closing tag are not patterns", () => {
  const text = lines(["const d = a / b / c;", "const j = <a>x</a>;", "const k = (n) / 2;"]);
  assert.equal(codeOnly(text), text);
});
