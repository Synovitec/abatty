import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";

// init's docs/README.md named only the two documents init wrote. A repository whose docs/ already
// held its own read each of them as missing from the index, docs.indexDrift is HARD, and the
// first baseline was refused. Each document already says what it is in its front matter.

const FM = (/** @type {string} */ title, /** @type {string} */ desc) =>
  `---\ntitle: "${title}"\ndescription: "${desc}"\ncategory: reference\nstatus: living\n---\n\n# ${title}\n`;

test("the index init writes names the documents already there, from their front matter", () => {
  const dir = tempRepo("docs-index", {
    "package.json": NEXT_PKG,
    "docs/smartparse-engine.md": FM("Smartparse", "How a statement is parsed | and why"),
    "docs/runbooks/onboarding-a-bank.md": FM("Onboarding", "Bringing a bank on"),
    "docs/notes.md": "# Notes without front matter\n",
  });
  cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  const index = readFileSync(join(dir, "docs/README.md"), "utf8");
  assert.match(
    index,
    /\| `smartparse-engine\.md` \| How a statement is parsed \\\| and why \| reference \| living \|/,
  );
  assert.match(index, /\| `runbooks\/onboarding-a-bank\.md` \| Bringing a bank on \|/);
  assert.match(index, /\| `notes\.md` \| - \| - \| - \|/);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  const r = cli(["ratchet", dir, "--plain"], dir);
  assert.match(r.out, /docs\.indexDrift\s+0\b/, r.out);
});

test("an index the repository already had learns of the two documents init writes beside it", () => {
  const dir = tempRepo("docs-index-kept", {
    "package.json": NEXT_PKG,
    "docs/README.md": "# Our docs\n\n| Doc | What |\n|---|---|\n| `guide.md` | the guide |\n",
    "docs/guide.md": FM("Guide", "How to use it"),
  });
  const r = cli(["init", "--profile", "synovitec", dir, "--stack", "next"], dir);
  assert.match(
    r.out,
    /merged\s+docs\/README\.md · rows added for STANDARDS_PROGRESS\.md, ADOPTION_DECISIONS\.md/,
  );
  const index = readFileSync(join(dir, "docs/README.md"), "utf8");
  assert.match(index, /^# Our docs/, "the repository's own index is kept");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  assert.match(cli(["ratchet", dir, "--plain"], dir).out, /docs\.indexDrift\s+0\b/);
});
