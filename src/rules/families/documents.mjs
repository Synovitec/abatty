/**
 * Documents: the agent's context file, the path-scoped rules, the conventions, the progress
 * scoreboard, the changelog, the docs index, the decisions, front matter and freshness.
 * Standard §2.1, DOC.1..5, AIR.1, CHANGE.1, FLOW.4.
 */

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "DOC-CONTEXT",
    family: "Documents",
    title: "CLAUDE.md exists and stays under 200 lines",
    standard: ["AIR.1"],
    level: "must",
    enforcement: "prose",
    phase: "A.1 / status",
    why: "The context file is read whole at the start of every session; past two hundred lines the model stops holding it and confidently applies the wrong half. The one repository that let it reach 1,124 lines is the motivating case.",
    next: "Move domain sections to .claude/rules/<topic>.md with paths: front matter; keep §1-§10 of the template",
    check: (c) => {
      const f = c.contextFile;
      const lines = f ? c.read(f).split(/\r?\n/).length : 0;
      return {
        status: !f ? "missing" : lines <= 200 ? "present" : "partial",
        evidence: f ? `${f}: ${lines} lines` : "no CLAUDE.md",
        next:
          lines > 200
            ? "Move domain sections to .claude/rules/<topic>.md with paths: front matter; keep §1-§10 of the template"
            : "Use the agent-context template (abatty init)",
      };
    },
  },
  {
    id: "DOC-CONTEXT-SECTIONS",
    family: "Documents",
    title: "CLAUDE.md carries delivery rules, skills table, autonomy contract, known gaps",
    standard: ["AIR.1"],
    level: "must",
    enforcement: "prose",
    phase: "A.1",
    why: "The five sections are what an agent needs and nothing else: the non-negotiables, the commands, how work is delivered, which protocol to follow, and what it may decide alone. A context file without them is a description, not an instruction.",
    next: "Add the missing sections from the agent-context template §7-§10",
    check: (c) => {
      const text = c.contextFile ? c.read(c.contextFile).toLowerCase() : "";
      const sections = [
        ["non-n[eé]gotiable|non-n[eé]gociable", "non-negotiables"],
        ["command", "commands"],
        ["changelog", "delivery rules / changelog"],
        ["skill", "skills and agents"],
        ["autonomy contract|unattended run|adoption_run", "autonomy contract"],
        ["known gap|gaps between|[eé]carts connus", "known gaps register"],
      ];
      const present = sections
        .filter(([re]) => new RegExp(String(re)).test(text))
        .map(([, n]) => n);
      return {
        status:
          present.length === sections.length
            ? "present"
            : present.length >= 3
              ? "partial"
              : "missing",
        evidence: `found: ${present.join(", ") || "none"}`,
      };
    },
  },
  {
    id: "DOC-RULES",
    family: "Documents",
    title: ".claude/rules/*.md path-scoped rules for stack and domain conventions",
    standard: ["AIR.1"],
    level: "should",
    enforcement: "prose",
    phase: "A.1",
    why: "A rule scoped to paths loads only when the agent touches those files, which keeps the context file short and the domain reasoning where it applies.",
    next: "Copy the applicable rules templates and scope them with paths:",
    check: (c) => {
      const rules = c.files(/^\.claude\/rules\/.*\.md$/);
      const scoped = rules.filter((r) => /^---\s*\n[\s\S]*?paths:/.test(c.read(r)));
      return {
        status: rules.length === 0 ? "missing" : scoped.length > 0 ? "present" : "partial",
        evidence: `${rules.length} rule file(s), ${scoped.length} path-scoped`,
      };
    },
  },
  {
    id: "DOC-CONVENTIONS",
    ceiling: {
      at: "review",
      why: "A machine can see the file and its headings. Whether it describes how THIS stack applies the standard, rather than repeating the standard, is a reading; a check that asserted it would be asserting that prose is good.",
    },
    family: "Documents",
    title: "A CODE_CONVENTIONS.md under docs: how this stack applies the standard",
    level: "should",
    enforcement: "prose",
    phase: "A.1",
    why: "The standard is generic; each stack applies it with named choices (folder layout, the ORM, the test runner). Written once, they stop being re-decided in every session.",
    next: "Write it from the standard §3-§7 for this stack",
    check: (c) => {
      const conv = c.firstFile(/^docs\/(CODE_)?CONVENTIONS\.md$/);
      return { status: conv ? "present" : "missing", evidence: conv || "none" };
    },
  },
  {
    id: "DOC-PROGRESS",
    family: "Documents",
    title: "A STANDARDS_PROGRESS.md under docs: numbers-only scoreboard and log",
    standard: ["P.3"],
    level: "must",
    enforcement: "review",
    phase: "0",
    why: "Honest reporting is numbers before and after, dated; a log that says 'improved' hides regressions. The scoreboard is where the ratchet's readings and the nights' receipts land.",
    next: "Create it with the scoreboard, phase table and dated log",
    check: (c) => {
      const p = c.firstFile(/^docs\/STANDARDS_PROGRESS\.md$/);
      return { status: p ? "present" : "missing", evidence: p || "none" };
    },
  },
  {
    id: "DOC-CHANGELOG",
    family: "Documents",
    title: "CHANGELOG.md in Keep-a-Changelog shape with an [Unreleased] section",
    standard: ["CHANGE.1"],
    level: "must",
    enforcement: "hard",
    phase: "0 / 11",
    why: "A change that is not written in the same push is lost to the next reader; the [Unreleased] section is where the gate checks that the push wrote it.",
    next: "Add ## [Unreleased] with Added/Changed/Fixed groups; enforce the same-push rule in the gate",
    check: (c) => {
      const path = c.exists("CHANGELOG.md")
        ? "CHANGELOG.md"
        : c.exists("docs/CHANGELOG.md")
          ? "docs/CHANGELOG.md"
          : "";
      const text = path ? c.read(path) : "";
      const unreleased = /\[Unreleased\]/i.test(text);
      return {
        status: !text ? "missing" : unreleased ? "present" : "partial",
        evidence: text
          ? `${path}: ${text.split(/\r?\n/).length} lines${unreleased ? ", has [Unreleased]" : ", no [Unreleased]"}`
          : "none",
      };
    },
  },
  {
    id: "DOC-INDEX",
    family: "Documents",
    title: "docs index listing every document",
    standard: ["DOC.3"],
    level: "must",
    enforcement: "hard",
    phase: "11",
    why: "A document nobody can find is a document nobody reads; the index is the one entry point, and a drift check keeps it equal to the tree.",
    next: "Create a README.md under docs with one row per document",
    check: (c) => {
      const index = c.firstFile(/^docs\/(README|SOMMAIRE|INDEX)\.md$/);
      return {
        status: index ? "present" : c.docFiles.length === 0 ? "n/a" : "missing",
        evidence: index || `${c.docFiles.length} docs, no index`,
      };
    },
  },
  {
    id: "DOC-ADR",
    ceiling: {
      at: "review",
      why: "A machine can count the entries and read their front matter. Whether the decisions that actually shaped the system are among them is knowable only to somebody who was there: the missing entry leaves no trace to scan for.",
    },
    family: "Documents",
    title: "A decisions record (MADR entries or a decision log)",
    standard: ["FLOW.4"],
    level: "must",
    enforcement: "prose",
    phase: "A.1",
    why: "A decision without a record is re-litigated by the next person or the next session; the night's decision codes land in the same file.",
    next: "Create a decisions folder under docs with 0001-*.md for the five day-0 decisions",
    check: (c) => {
      const found =
        c.exists("docs/DECISIONS.md") ||
        c.exists("docs/decisions") ||
        c.exists("docs/DECISIONS_TECHNIQUES.md") ||
        c.files(/^docs\/adr\//).length > 0;
      return { status: found ? "present" : "missing", evidence: found ? "found" : "none" };
    },
  },
  {
    id: "DOC-FRONTMATTER",
    family: "Documents",
    title: "Every doc opens with front matter",
    standard: ["DOC.2"],
    level: "must",
    enforcement: "hard",
    phase: "11",
    why: "The front matter (title, status, audience, related, last_verified) is what lets a machine list, date and index the documents; without it every doc check is a guess.",
    next: "Add the standard's front matter to every doc and a check that fails without it",
    check: (c) => {
      const withFm = c.docFiles.filter((d) => /^---\s*\n/.test(c.read(d)));
      return {
        status:
          c.docFiles.length === 0
            ? "n/a"
            : withFm.length === c.docFiles.length
              ? "present"
              : withFm.length > 0
                ? "partial"
                : "missing",
        evidence: `${withFm.length}/${c.docFiles.length} docs with front matter`,
      };
    },
  },
  {
    id: "DOC-FRESHNESS",
    family: "Documents",
    title: "Docs carry last_verified and source_truth so freshness is measured by the diff",
    standard: ["DOC.5"],
    level: "must",
    enforcement: "ratchet",
    phase: "11",
    why: "A doc that names the code it describes can be checked against the diff: when the code moved after the doc was verified, the doc is behind, and an agent reading it confidently does the wrong thing.",
    next: "Add last_verified and source_truth; add a behind-code or freshness metric to the ratchet",
    check: (c) => {
      const n = c.docFiles.length;
      const dated = c.docFiles.filter((d) =>
        /^(last_verified|last_reviewed|updated):/m.test(c.read(d).slice(0, 2000)),
      );
      const sourced = c.docFiles.filter((d) => /^source_truth:/m.test(c.read(d).slice(0, 3000)));
      return {
        status:
          n === 0
            ? "n/a"
            : dated.length === n && sourced.length > n / 2
              ? "present"
              : dated.length > 0
                ? "partial"
                : "missing",
        evidence: `${dated.length}/${n} dated, ${sourced.length} with source_truth`,
      };
    },
  },
  {
    id: "DOC-AGENTS-MD",
    family: "Documents",
    title: "AGENTS.md imported by CLAUDE.md when other agents read the repo (optional)",
    level: "should",
    enforcement: "prose",
    phase: "-",
    why: "Two context files drift apart; when both exist, one imports the other so there is one source.",
    next: "Start CLAUDE.md with @AGENTS.md if both must stay in sync",
    check: (c) => {
      const agents = c.exists("AGENTS.md");
      const imported = c.contextFile ? /@AGENTS\.md/.test(c.read(c.contextFile)) : false;
      return {
        status: agents ? (imported ? "present" : "partial") : "n/a",
        evidence: agents ? "AGENTS.md present" : "no AGENTS.md (fine)",
      };
    },
  },
];
