import { test } from "node:test";
import assert from "node:assert/strict";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";

// init's last step said "Fill CLAUDE.md (the placeholders in <>)" to a repository whose own
// context file has none, and to one whose placeholders are in AGENTS.md, which CLAUDE.md imports.

test("a fresh repository is asked to fill the file the template went into, with the count", () => {
  const dir = tempRepo("ctx-fresh", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next"], dir);
  assert.match(r.out, /\d+\. Fill AGENTS\.md \(\d+ placeholder\(s\) in <>\)/);
  assert.equal(r.out.includes("Fill CLAUDE.md"), false, r.out);
});

test("a repository with its own context file is told it was kept and how AGENTS.md relates", () => {
  const dir = tempRepo("ctx-own", {
    "package.json": NEXT_PKG,
    "CLAUDE.md": "# Mine\n\nThe real context, written by hand.\n",
  });
  const r = cli(["init", dir, "--stack", "next"], dir);
  const said = "CLAUDE.md is this repository's own and was kept; AGENTS.md points at it";
  assert.ok(r.out.includes(said), r.out);
  assert.doesNotMatch(r.out, /Fill /);
});
