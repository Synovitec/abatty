/**
 * Today's date, in the timezone of whoever is running this.
 *
 * WHY this is a module rather than an expression. Every date this package compares is a LOCAL
 * date: git's `%cs` is the committer's local day, a `last_verified` line in front matter is the
 * day a person wrote it, and a waiver's `until` is the day somebody meant on their own calendar.
 * `new Date().toISOString()` is UTC, and mixing the two produces a defect that is invisible to
 * anybody at Greenwich and real for everybody else, in the offset window either side of midnight.
 *
 * It was real here: `docs.behindCode` reported a document as behind code it had been verified
 * against on the same day, because the probe's same-day guard compared a UTC "today" against a
 * local commit date. It is a hard metric, so it failed a gate, for every user east of Greenwich
 * in the hours before midnight and west of it after. Its own control case caught it.
 *
 * So there is one implementation and every caller uses it, which is what makes the mistake
 * unavailable rather than merely fixed.
 */

/** @param {number} n */
const pad = (n) => String(n).padStart(2, "0");

/**
 * Today as YYYY-MM-DD, in the local timezone.
 * @param {Date} [now] the instant to read, for a test that pins one
 * @returns {string}
 */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
