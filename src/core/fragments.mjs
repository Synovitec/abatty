/**
 * Changelog fragments: one file per change instead of a line in a shared section. The rule that a
 * change says what it changed in the same push holds either way; with a line under
 * `## [Unreleased]`, every pair of parallel branches edits the same hunk, and an adopter merging
 * eight pull requests in a day resolved four conflicts, every one of them in the changelog and
 * none in code. A fragment is a new file, so two branches never touch the same one, and the
 * release folds them into the dated section.
 *
 * A fragment is `<folder>/<slug>.<section>.md`: the section one of Keep a Changelog's
 * (added, changed, deprecated, removed, fixed, security), the body the entry as it will read.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Keep a Changelog's sections, in the order a release lists them. */
export const SECTIONS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];

/**
 * The fragments waiting in a folder, with the section each names; a file whose name names no
 * section is read as Changed rather than dropped, since the entry is what matters.
 * @param {string} repoDir @param {string} folder relative to the repository
 * @returns {{ file: string, section: string, body: string }[]}
 */
export function readFragments(repoDir, folder) {
  const dir = join(repoDir, folder);
  if (!folder || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !/^readme\.md$/i.test(f))
    .sort()
    .map((f) => {
      const named = f.replace(/\.md$/, "").split(".").pop()?.toLowerCase() || "";
      const section = SECTIONS.find((s) => s.toLowerCase() === named) || "Changed";
      return { file: `${folder}/${f}`, section, body: readFileSync(join(dir, f), "utf8").trim() };
    })
    .filter((x) => x.body);
}

/**
 * Cut a release: what stands under `## [Unreleased]` and every fragment become the section
 * `## [version] - date`, grouped by section, and the fragments are removed. `[Unreleased]` stays,
 * empty, for the next change.
 * @param {{ repoDir: string, changelog: string, folder: string, version: string, date: string }} o
 * @returns {{ fragments: number, written: boolean }}
 */
export function foldRelease(o) {
  const path = join(o.repoDir, o.changelog);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "# Changelog\n\n## [Unreleased]\n";
  const head = /^## \[Unreleased\][^\n]*\n/m.exec(text);
  if (!head) throw new Error(`${o.changelog} has no ## [Unreleased] section to release`);
  const start = head.index + head[0].length;
  const next = text.slice(start).search(/^## \[/m);
  const end = next < 0 ? text.length : start + next;
  /** @type {Map<string, string[]>} */
  const by = new Map();
  let section = "Changed";
  // The lines already under [Unreleased], kept under the section they were written in.
  for (const block of text.slice(start, end).split(/^(?=### )/m)) {
    const title = /^### (.+)$/m.exec(block);
    if (title) section = String(title[1]).trim();
    const body = block.replace(/^### .+\n/, "").trim();
    if (body) by.set(section, [...(by.get(section) || []), body]);
  }
  const fragments = readFragments(o.repoDir, o.folder);
  for (const f of fragments) by.set(f.section, [...(by.get(f.section) || []), f.body]);
  const order = [...SECTIONS, ...[...by.keys()].filter((s) => !SECTIONS.includes(s))];
  const body = order
    .filter((s) => by.get(s)?.length)
    .map((s) => `### ${s}\n\n${(by.get(s) || []).join("\n")}\n`)
    .join("\n");
  const release = `## [${o.version}] - ${o.date}\n\n${body || "Nothing recorded.\n"}\n`;
  writeFileSync(path, `${text.slice(0, start)}\n${release}${text.slice(end)}`);
  for (const f of fragments) rmSync(join(o.repoDir, f.file));
  return { fragments: fragments.length, written: true };
}
