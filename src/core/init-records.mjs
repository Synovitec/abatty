/**
 * The synovitec standard's records, written by `init` under that profile alone: the changelog,
 * the docs index, the standards scoreboard and the adoption decisions. Kept apart from `init`
 * itself, which a profile with none of them (minimal) never reaches.
 */
import { existingDocRows, indexOwnDocs } from "./docs-index.mjs";

/**
 * Write the records where they are absent; an index the repository already kept learns of the
 * two documents written beside it.
 * @param {(rel: string, text: string) => boolean} put init's writer: true when it wrote
 * @param {string} repoDir @param {import("./init.mjs").InitEvent[]} events @param {boolean} dryRun
 */
export function writeRecords(put, repoDir, events, dryRun) {
  put(
    "CHANGELOG.md",
    "# Changelog\n\nKeep a Changelog, SemVer. Every commit that touches source, tests, scripts, CI, migrations or docs adds a line under Unreleased in the same commit (CHANGE.1, CHANGE.2).\n\n## [Unreleased]\n\n### Added\n\n- The engineering standard's instrument: harness, gate, import graph, dead code (`abatty init`).\n",
  );
  const indexWritten = put(
    "docs/README.md",
    // With the front matter the ratchet's own docs.frontMatter probe asks of every document: an
    // index written without it made every freshly initialised repository red on its first clean
    // ratchet, and a controls pass that read that red as a proof.
    '---\ntitle: "Documentation index"\ndescription: "Every document under docs/ with what it is for, its category and its status; the one entry point, kept equal to the tree by the ratchet."\ncategory: reference\nstatus: living\naudience: ["developer", "agent"]\ntags: ["index", "docs"]\n---\n\n' +
      "# Documentation index\n\nEvery document under docs/ is listed here (DOC.3): what it is for, its category and status.\n\n| Document | What it is for | Category | Status |\n|---|---|---|---|\n| `STANDARDS_PROGRESS.md` | The standards scoreboard: numbers only, dated; one log entry per deliberate change of a floor | governance | living |\n| `ADOPTION_DECISIONS.md` | The decisions an unattended adoption night takes alone: date, phase, default taken, the alternative | governance | living |\n" +
      // The documents the repository already had, from their own front matter: listed without
      // them, each read as missing from the index and the first baseline was refused.
      existingDocRows(repoDir, ["STANDARDS_PROGRESS.md", "ADOPTION_DECISIONS.md"]),
  );
  put(
    "docs/STANDARDS_PROGRESS.md",
    '---\ntitle: "Standards progress"\ndescription: "The scoreboard of the engineering standard on this repository: what each metric measures, the ratchet that holds it, the phases open, and the dated log of every deliberate change of a floor. Numbers only, never \'improved\'."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "ratchet", "scoreboard"]\nrelated: ["./README.md", "./ADOPTION_DECISIONS.md"]\n---\n\n# Standards progress\n\n## Scoreboard\n\n| Metric | Day 0 | Now | Target | Held by | Rule |\n|---|---|---|---|---|---|\n\n## Phase status\n\n| # | Phase | Status |\n|---|---|---|\n\n## Log\n\n',
  );
  put(
    "docs/ADOPTION_DECISIONS.md",
    '---\ntitle: "Adoption decisions"\ndescription: "The decisions taken alone by the unattended adoption nights (/adopt-standards): date, phase, situation, the default taken, the alternative set aside, what the morning must re-read."\ncategory: governance\nstatus: living\naudience: ["developer", "agent"]\ntags: ["standards", "adoption", "decisions"]\nrelated: ["./README.md", "./STANDARDS_PROGRESS.md"]\n---\n\n# Adoption decisions\n\n',
  );
  // An index the repository already kept learns of the two documents written beside it: left
  // out, each read as missing from it, and the first baseline was refused (docs.indexDrift).
  if (!indexWritten) indexOwnDocs(repoDir, events, dryRun);
}
