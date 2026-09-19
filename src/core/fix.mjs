/**
 * `abatty fix`: the mechanical part of a phase, written rather than described. A tool that only
 * refuses is half a tool, and most of what day zero asks for is not a judgement - a document with
 * front matter, a row in the index, a decision record with the five decisions already taken. The
 * judgement is what goes inside them, and that stays with the author.
 *
 * Two rules the fixers obey, both learned from this repository's own gate. What is written must
 * satisfy the rules the repository already has, so a fix never trades one finding for another:
 * a document carries front matter and a row in the index, or it is a new finding the moment it
 * lands. And nothing is written without being shown: the default is the plan, `--write` performs
 * it, so the destructive direction is the one that needs the flag.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * @typedef {{ rule: string, path: string, why: string, text: (o: { name: string, date: string }) => string }} Fixer
 * @typedef {{ rule: string, path: string, why: string, action: "write" | "held", text: string }} FixStep
 */

const FM = (
  /** @type {string} */ title,
  /** @type {string} */ description,
  /** @type {string} */ category,
  /** @type {string} */ date,
) =>
  `---\ntitle: "${title}"\ndescription: "${description}"\ncategory: ${category}\nstatus: living\naudience: ["developer", "agent"]\ntags: []\nlast_verified: "${date}"\n---\n\n`;

/** @type {Fixer[]} */
export const FIXERS = [
  {
    rule: "DOC-CONVENTIONS",
    path: "docs/CODE_CONVENTIONS.md",
    why: "The standard is generic; this file is where a stack's own choices are written once instead of being re-decided every session.",
    text: ({ name, date }) =>
      FM(
        "Code conventions",
        `How ${name} applies the engineering standard: the choices this stack makes, written once.`,
        "guide",
        date,
      ) +
      `# Code conventions\n\nHow this repository applies the standard. The standard says what must hold; this file says how\nit holds here, so the same question is not re-decided in every session.\n\n## Folder layout\n\n<!-- Where code, tests, documents and configuration live, and what each folder is for. -->\n\n## Naming\n\n<!-- Files, exports, tests. One rule per line, each one a reviewer could check. -->\n\n## The tools this stack names\n\n<!-- The linter, the type checker, the test runner, the formatter: the choice and the reason. -->\n\n## What is deliberately not done here\n\n<!-- A practice the standard allows that this repository does not use, and why. -->\n`,
  },
  {
    rule: "DOC-ADR",
    path: "docs/decisions/0001-record-decisions.md",
    why: "A decision without a record is re-litigated by the next person or the next session.",
    text: ({ date }) =>
      FM(
        "Record the decisions",
        "The first decision: that decisions are written down here, one file each, and never deleted.",
        "governance",
        date,
      ) +
      `# 0001 - Record the decisions\n\n- Status: accepted\n- Date: ${date}\n\n## Context\n\nA decision nobody wrote down is taken again by the next person, or by the next session, usually\ndifferently. The cost is not the first decision; it is the third time it is re-argued.\n\n## Decision\n\nEvery decision that constrains the code lands here as its own file, numbered in order, and is\nnever deleted. A decision that is reversed gets a new file that supersedes the old one, and the\nold one stays.\n\n## Consequences\n\nThe record grows and is never tidied. That is the point: what was true and why it changed is the\npart a reader needs, and a tidy record has lost it.\n`,
  },
];

/** The row an index needs for a document, in the shape this package writes. @param {string} path @param {string} what */
const indexRow = (path, what) =>
  `| \`${path.replace(/^docs\//, "")}\` | ${what} | guide | living |`;

/**
 * What `fix` would do for a phase: one step per rule of that phase with a fixer, skipped when the
 * rule already holds. Nothing is written here.
 * @param {{ repoDir: string, findings: import("../rules/index.mjs").Finding[], phase: string, name: string, date: string }} o
 * @returns {FixStep[]}
 */
export function planFix(o) {
  const open = new Set(
    o.findings
      .filter(
        (f) =>
          (f.status === "missing" || f.status === "partial") &&
          f.phase.split(/\s*\/\s*/).includes(o.phase),
      )
      .map((f) => f.id),
  );
  return FIXERS.filter((f) => open.has(f.rule)).map((f) => ({
    rule: f.rule,
    path: f.path,
    why: f.why,
    action: existsSync(join(o.repoDir, f.path))
      ? /** @type {const} */ ("held")
      : /** @type {const} */ ("write"),
    text: f.text({ name: o.name, date: o.date }),
  }));
}

/**
 * Write the steps, and keep the index equal to the tree in the same pass: a document that lands
 * without its row trades one finding for another, which is the failure a fixer must never have.
 * @param {string} repoDir @param {FixStep[]} steps
 * @returns {string[]} the paths written
 */
export function applyFix(repoDir, steps) {
  /** @type {string[]} */
  const written = [];
  for (const s of steps) {
    if (s.action !== "write") continue;
    const target = join(repoDir, s.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, s.text);
    written.push(s.path);
  }
  const index = join(repoDir, "docs", "README.md");
  if (written.length && existsSync(index)) {
    const text = readFileSync(index, "utf8");
    const rows = written
      .filter((p) => !text.includes(p.replace(/^docs\//, "")))
      .map((p) => indexRow(p, FIXERS.find((f) => f.path === p)?.why || "written by abatty fix"));
    if (rows.length) {
      const lines = text.split("\n");
      let last = -1;
      for (let i = 0; i < lines.length; i++) if (String(lines[i]).startsWith("| ")) last = i;
      if (last >= 0) {
        lines.splice(last + 1, 0, ...rows);
        writeFileSync(index, lines.join("\n"));
        written.push("docs/README.md");
      }
    }
  }
  return written;
}
