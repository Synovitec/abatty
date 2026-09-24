import { test } from "node:test";
import assert from "node:assert/strict";
import { frontMatterFaults } from "../src/ratchet/probes/frontmatter.mjs";

// An adopter's docs passed every docs probe with front matter a YAML reader refuses. Each case
// below was read by a YAML parser when this reading was written: the refused ones are faults, the
// accepted ones are not, so the hand reading and a real reader agree without a dependency.

const faults = (/** @type {string} */ block) =>
  frontMatterFaults(`---\n${block}\n---\n\n# T\n`).map((f) => `${f.line} ${f.fault}`);

test("what a YAML reader refuses is a fault, on its line", () => {
  assert.deepEqual(faults('title: "A"\ntitle: "B"'), ["3 `title` twice"]);
  assert.deepEqual(faults('title: "A"\n  status: living'), [
    "3 `status: living` indented under a scalar",
  ]);
  assert.deepEqual(faults('title: "A"\n- a'), ["3 a list item under a scalar"]);
  assert.deepEqual(faults('title: "open'), ["2 `title`: a quote that does not close"]);
  assert.deepEqual(faults("title: A: B"), ["2 `title`: a `: ` inside an unquoted value"]);
  assert.deepEqual(faults("title: @scope"), ["2 `title`: `@` cannot open an unquoted value"]);
  assert.deepEqual(faults("related: [a, b"), ["2 `related`: a list that does not close"]);
  assert.deepEqual(faults("title: A\n\tstatus: x"), [
    "3 a tab in the indentation",
    "3 `status: x` indented under a scalar",
  ]);
  assert.deepEqual(faults("description: long text\n  continues: here"), [
    "3 `continues: here` indented under a scalar",
  ]);
});

test("what a YAML reader accepts is not a fault", () => {
  for (const block of [
    "title:\n  status: living",
    "tags:\n- a\n- b",
    'title: "Issue #4"',
    "title: 'it''s'",
    "title: A:B",
    "title: A # a comment: here",
    "title: C# notes",
    "related: [a, b] # c",
    "meta: {a: 1}",
    "description: long text\n  continues here",
    "url: http://x.y",
    "title: 50%",
    "title: '#x'",
    "key: |\n  text: with colon",
    "key: >\n  folded",
    "last_verified: 2026-09-24",
  ])
    assert.deepEqual(faults(block), [], block);
});

test("a document without front matter has no faults: its absence is reported on its own", () => {
  assert.deepEqual(frontMatterFaults("# T\n\ntitle: A: B\n"), []);
});

test("a CRLF document is read like an LF one", () => {
  assert.deepEqual(
    frontMatterFaults('---\r\ntitle: "A"\r\ntitle: "B"\r\n---\r\n'),
    ["`title` twice"].map((fault) => ({ line: 3, fault })),
  );
});
