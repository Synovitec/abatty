/**
 * The succession of dated readings `measure` writes. Each run wrote `GAP_ANALYSIS_<date>.md` and
 * left the one before it as it was, so the series never named its newest reading, and an
 * adopter's older reading was quoted as the current score. The reading `measure` just wrote is
 * the successor of the newest one before it, and this module writes that link.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DATED_READING, readingSeries } from "../ratchet/probes/succession.mjs";

/**
 * Names `written` as the successor of every earlier reading of its series that names none,
 * each pointing at the reading that follows it. A reading that already names one is left alone,
 * and so is a document without front matter. Returns the file names it changed.
 * @param {string} written absolute path of the reading `measure` wrote
 * @returns {string[]}
 */
export function linkPreviousReadings(written) {
  const name = basename(written);
  if (!DATED_READING.test(name)) return [];
  const dir = dirname(written);
  const siblings = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const series = readingSeries(siblings.map((f) => `./${f}`)).find((s) => s.includes(`./${name}`));
  if (!series) return [];
  const changed = [];
  const upTo = series.indexOf(`./${name}`);
  for (let i = 0; i < upTo; i++) {
    const file = join(dir, String(series[i]).slice(2));
    const text = readFileSync(file, "utf8");
    const linked = withSuccessor(text, String(series[i + 1]));
    if (linked === text) continue;
    writeFileSync(file, linked);
    changed.push(basename(file));
  }
  return changed;
}

/**
 * The document with `superseded_by` set to `next` in its front matter, or the text unchanged when
 * it already names a successor or has no front matter. An empty `superseded_by:` line is filled
 * in place rather than doubled, which a YAML reader would refuse.
 * @param {string} text @param {string} next
 */
export function withSuccessor(text, next) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  if (!text.startsWith("---")) return text;
  const end = text.indexOf(`${eol}---`, 3);
  if (end < 0) return text;
  const head = text.slice(0, end);
  const line = `superseded_by: "${next}"`;
  const existing = /^superseded_by:[ \t]*([^\r\n]*)/m.exec(head);
  if (existing && existing[1] && existing[1].replace(/["'\s]/g, "")) return text;
  const updated = existing
    ? head.slice(0, existing.index) + line + head.slice(existing.index + existing[0].length)
    : head + eol + line;
  return updated + text.slice(end);
}
