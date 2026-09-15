/**
 * Delivery: Conventional Commits, no authorship trailer, no em-dash, the changelog checked
 * over the pushed range, a version. Standard FLOW-1, CHANGE-1.
 */

// The trailer's name, reversed so this file does not carry it (the vocabulary's own rule).
const TRAILER = new RegExp("^" + [..."yB-derohtuA-oC"].reverse().join("") + ":", "i");
// The code point, not the character: this file must itself pass the rule it checks.
const EM_DASH = new RegExp(String.fromCharCode(0x2014));

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "FLOW-COMMITS",
    family: "Delivery",
    title: "Conventional Commits",
    standard: ["FLOW-1"],
    level: "must",
    enforcement: "review",
    phase: "1",
    why: "A commit subject with a type and a scope is a changelog line and a filter; without the format the history is prose nobody searches.",
    next: "Adopt the format; a commit-msg hook can refuse the rest",
    check: (c) => {
      const subjects = c
        .git("log", "-50", "--no-merges", "--format=%s")
        .split("\n")
        .filter(Boolean);
      const conventional = subjects.filter((s) =>
        /^(feat|fix|refactor|docs|test|chore|ci|perf|build|style|revert)(\([^)]+\))?!?: /.test(s),
      );
      return {
        status:
          subjects.length === 0
            ? "n/a"
            : conventional.length === subjects.length
              ? "present"
              : conventional.length >= subjects.length * 0.8
                ? "partial"
                : "missing",
        evidence: `${conventional.length}/${subjects.length} of the last commits`,
      };
    },
  },
  {
    id: "FLOW-TRAILER",
    family: "Delivery",
    title: "No authorship trailer, where the repository opted into the scrub",
    standard: ["FLOW-1"],
    level: "must",
    enforcement: "hard",
    phase: "-",
    why: "Provenance is the default: an agent's trailer on the commits it made is the audit trail. A repository that opted into the scrub (white-label work, scrub.enabled) keeps its history free of the name, and the commit-msg hook refuses the line before it lands.",
    next: 'Set attribution.commit to "" in the user settings; install the commit-msg hook (abatty scrub --message)',
    check: (c) => {
      const enabled =
        c.adoption?.scrub?.enabled === true ||
        c.readJson("abatty.config.json")?.scrub?.enabled === true;
      if (!enabled)
        return { status: "n/a", evidence: "provenance kept; the scrub is off (scrub.enabled)" };
      const trailers = c
        .git("log", "-50", "--format=%b")
        .split("\n")
        .filter((l) => TRAILER.test(l)).length;
      return {
        status: trailers === 0 ? "present" : "partial",
        evidence: `${trailers} trailer(s) in the last 50 commits`,
      };
    },
  },
  {
    id: "FLOW-EMDASH",
    family: "Delivery",
    title: "No em-dash in code, copy or docs",
    standard: ["FLOW-1"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    why: "The character is the signature of generated text and a locale problem in copy; a hyphen says the same.",
    next: "Replace with a hyphen; add the ratchet metric i18n.emDashInCopy",
    check: (c) => {
      // Frozen snapshots under an archived folder are not copy and are never edited; a
      // repository that keeps them says so in its rules, and the check reads the same scope.
      const files = [...c.sourceFiles, ...c.docFiles, "CHANGELOG.md", "README.md"].filter(
        (f) => !/(^|\/)archived\//.test(f) && EM_DASH.test(c.read(f)),
      );
      return {
        status: files.length === 0 ? "present" : files.length < 10 ? "partial" : "missing",
        evidence: `${files.length} file(s)${files.length ? ": " + files.slice(0, 5).join(", ") : ""}`,
      };
    },
  },
  {
    id: "FLOW-CHANGELOG-GATE",
    family: "Delivery",
    title: "Changelog-touched check over the pushed range",
    standard: ["CHANGE-1"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    why: "The rule 'changelog in the same push' is prose until the gate reads the pushed range and refuses a source change without its line.",
    next: "Add changelog.missing to the ratchet with --range auto",
    check: (c) => {
      const text = [...c.files(/^scripts\/ci\//).map(c.read), c.ciText].join("\n");
      const found = /CHANGE-2|changelog\.missing|changelog/i.test(text);
      return {
        status: found ? "present" : "missing",
        evidence: found ? "a check mentions the changelog" : "none",
      };
    },
  },
  {
    id: "FLOW-VERSION",
    family: "Delivery",
    title: "A version the release process bumps (SemVer)",
    level: "should",
    enforcement: "prose",
    phase: "-",
    why: "A release without a number cannot be named in a bug report or pinned by a consumer.",
    next: "Keep a SemVer version and cut [Unreleased] into a dated section on release",
    check: (c) => {
      const v = c.pkg.version;
      const doc = c.exists("docs/version.json");
      return {
        status: v || doc ? "present" : "missing",
        evidence: v ? `package.json ${v}` : doc ? "docs/version.json" : "none",
      };
    },
  },
];
