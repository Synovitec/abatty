/**
 * What a YAML reader would refuse, or read differently, in a document's front matter. The probes
 * read front matter by hand (the package has no dependency), and that reading forgave what a site
 * generator or a content schema does not: an adopter's docs passed every docs probe with front
 * matter a YAML reader refuses. This is the stricter reading, still by hand, of the faults a YAML
 * reader refuses or reads as another structure; not a validator. An unquoted date is not among
 * them: a reader accepts it, and hundreds of adopters' documents write one on purpose.
 */

const KEY = /^([A-Za-z_][\w-]*):(?:\s+(.*)|\s*)$/;
// Characters YAML reserves at the start of a plain scalar.
const RESERVED = /^[@`%]/;
const QUOTED_DOUBLE = /^"(?:[^"\\]|\\.)*"(?:\s+#.*)?$/;
const QUOTED_SINGLE = /^'(?:[^']|'')*'(?:\s+#.*)?$/;

/**
 * The faults of a front matter block, each with its line in the document. Empty when the document
 * has none, or has no front matter at all (that absence is reported on its own).
 * @param {string} text
 * @returns {{ line: number, fault: string }[]}
 */
export function frontMatterFaults(text) {
  const t = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, "\n");
  if (!t.startsWith("---")) return [];
  const end = t.indexOf("\n---", 3);
  if (end < 0) return [];
  const body = t.slice(3, end).split("\n");
  /** @type {{ line: number, fault: string }[]} */
  const faults = [];
  const seen = new Set();
  // The value of the key above: a scalar cannot own an indented key, an empty one can.
  let scalar = false;
  for (let i = 1; i < body.length; i++) {
    const line = String(body[i]);
    const at = i + 1;
    const fault = (/** @type {string} */ f) => faults.push({ line: at, fault: f });
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = /^[ \t]*/.exec(line)?.[0] || "";
    if (indent.includes("\t")) fault("a tab in the indentation");
    if (indent) {
      if (scalar && KEY.test(line.trim())) fault(`\`${line.trim()}\` indented under a scalar`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (scalar) fault("a list item under a scalar");
      continue;
    }
    const kv = KEY.exec(line);
    if (!kv) {
      fault(`\`${line}\` is not a \`key: value\` line`);
      continue;
    }
    const key = String(kv[1]);
    if (seen.has(key)) fault(`\`${key}\` twice`);
    seen.add(key);
    const value = (kv[2] || "").trim();
    // A block scalar (`|`, `>`) owns the indented lines below it, colons and all.
    scalar = value !== "" && !/^[#|>]/.test(value);
    const problem = valueFault(value);
    if (problem) fault(`\`${key}\`: ${problem}`);
  }
  return faults;
}

/** What is wrong with an inline value, or "" when a YAML reader takes it as written. @param {string} raw */
function valueFault(raw) {
  // A quoted value owns every `#` inside it; only what follows its closing quote can be a comment.
  if (raw[0] === '"') return QUOTED_DOUBLE.test(raw) ? "" : "a quote that does not close";
  if (raw[0] === "'") return QUOTED_SINGLE.test(raw) ? "" : "a quote that does not close";
  const v = raw.replace(/(^|\s+)#.*$/, "").trim();
  if (!v) return "";
  const q = v[0];
  if (q === "[") return v.endsWith("]") ? "" : "a list that does not close";
  if (q === "{") return v.endsWith("}") ? "" : "a map that does not close";
  if (RESERVED.test(v)) return `\`${v[0]}\` cannot open an unquoted value`;
  if (/:\s/.test(v) || v.endsWith(":")) return "a `: ` inside an unquoted value";
  return "";
}

const FM = (extra = "") =>
  `---\ntitle: "T"\ndescription: "D"\ncategory: reference\nstatus: living\n${extra}---\n\n# T\n`;

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "docs.frontMatterSyntax",
    kind: "ratchet",
    probation: true,
    standard: ["DOC.2"],
    title: "Documents whose front matter a YAML reader refuses",
    why: "A block a YAML reader refuses is no front matter to a site generator or a content schema, even when a hand reading finds its keys: the document drops out of every list built from it. Fix the line named: a key written once, at the left margin, a quote closed, a value with a `: ` in it quoted.",
    approximates:
      "stands in for a YAML parser, which would be a dependency: a hand reading of the faults a reader refuses or reads as another structure (a duplicate key, a key or a list item indented under a scalar, a tab in the indentation, a quote, list or map left open, a `: ` inside an unquoted value, a reserved first character), checked against a parser on 642 real documents; an unquoted date is not counted, since a reader accepts it",
    axis: "docs-freshness",
    lossAt: 30,
    scan: (c) => {
      const findings = [];
      for (const f of c.docFiles) {
        const [fault, ...more] = frontMatterFaults(c.read(f));
        if (fault)
          findings.push({
            path: f,
            line: fault.line,
            detail: `${fault.fault}${more.length ? ` (and ${more.length} more)` : ""}`,
          });
      }
      return { scanned: c.docFiles.length, findings };
    },
    controls: [
      {
        name: "a duplicate key, a key indented under a scalar, an open list and an open quote",
        files: {
          "docs/a.md": FM("status: stable\n"),
          "docs/b.md": FM('owner: "platform"\n  reviewed: yes\n'),
          "docs/c.md": FM('tags: ["x"\n'),
          "docs/d.md": FM('summary: "open\n'),
        },
        expect: 4,
      },
      {
        name: "a list, a block scalar, a quoted colon, an unquoted date and no front matter hold",
        files: {
          "docs/a.md": FM(),
          "docs/b.md": FM('tags:\n- a\n- b\nnotes: |\n  due: soon\nrelated: ["./a.md"] # c\n'),
          "docs/c.md": FM('owner: "Issue #4: platform"\nlast_verified: 2026-09-24\n'),
          "docs/d.md": "# D\n\ntitle: A: B\n",
        },
        expect: 0,
      },
    ],
  },
];
