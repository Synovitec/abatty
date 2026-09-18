/**
 * The words that must not appear in a repository: in its files, its commit messages, its pull
 * requests. Stored REVERSED (with a caret inside the short ones, whose reverse would read as a word) so that this file does not itself contain them; `TERMS` turns each
 * back into a regular-expression source. The hooks carry an identical copy
 * (this file is that copy; the package holds the original in src/core/vocabulary.mjs);
 * test/vocabulary.test.mjs proves the two files are the same.
 *
 * `bounded` terms match as whole words only (a two- or three-letter word inside another word is
 * not a mention). The list is deliberately short and blunt; a repository allows a product term
 * of its own through `adoption.json` → `scrub.allow` (path substrings), never by editing this.
 */

/** @type {[reversed: string, bounded: boolean][]} */
const ENTRIES = [
  ["edualc", false], // the tool's name, any case, any suffix (a URL, a version, a settings file)
  ["ciporhtna", false], // its maker
  ["I^A", true], // the two-letter word, English (a caret keeps this list from reading as the word)
  ["A^I", true], // the two-letter word, French
  ["M^LL", true],
  ["T^PG", true],
  ["tolipoc", false],
  ["ianepo", false],
  ["tpgtahc", false],
  ["yb-derohtua-oc", false], // the trailer
  ["htiw detareneg", false], // the footer
];

/** @param {string} s */
const reverse = (s) => [...s].reverse().join("").replace(/\^/g, "");
/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The decoded regex sources, in the list's order. */
export const TERMS = ENTRIES.map(([r, bounded]) => {
  const word = escape(reverse(r));
  return bounded ? `\\b${word}(?:-?\\d)?\\b` : word;
});

/** One case-insensitive expression for every term. */
export const FORBIDDEN = new RegExp(TERMS.join("|"), "i");

/** The same, global, for counting and locating matches in a text. */
export const FORBIDDEN_ALL = new RegExp(TERMS.join("|"), "gi");

/**
 * The paths a repository can never scrub because the agent itself requires those names: its
 * settings folder (with or without a trailing slash) and its context file. A line that mentions
 * only those is not a finding. Order matters: the slashed form is replaced before the bare one.
 */
export const REQUIRED_PATHS = [
  reverse("/edualc."),
  reverse("edualc./~"),
  reverse("edualc."),
  reverse("dm.EDUALC"),
];

/** @param {string} line */
export function onlyRequiredPaths(line) {
  let rest = line;
  for (const p of REQUIRED_PATHS) rest = rest.split(p).join("");
  return !FORBIDDEN.test(rest);
}

/** A sample of the trailer, built at runtime, for the guard's self-test. */
export function sampleTrailer() {
  return `${reverse("yB-derohtuA-oC")}: ${reverse("tnegA")} <noreply@example.com>`;
}
