/**
 * The day's table: today's reading beside the one before it, as rows a team lead reads first.
 * The outside trial's reviewer assembled this table by hand from two JSON files and the commit
 * log for two days; the reports on disk already carry every number in it. A row whose value did
 * not move says so rather than dropping out, because "unchanged" is also news on the day a
 * change was expected. The findings that changed status are named, since a score that held
 * still can hide one check fixed and another broken.
 */

/**
 * @typedef {import("./report.mjs").Report} Report
 * @typedef {{ label: string, before: string, now: string, change: "better" | "worse" | "same" | "new" }} DayRow
 * @typedef {{ id: string, from: string, to: string, change: "better" | "worse" | "same" }} Moved
 *   `same`: a move between statuses worth the same (present, waived and n/a), said neutrally.
 */

/** How good a status is, for telling a move up from a move down. */
const RANK = /** @type {Record<string, number>} */ ({
  missing: 0,
  partial: 1,
  present: 2,
  waived: 2,
  "n/a": 2,
});

/** Worse first, then the neutral moves, then the better ones. */
const ORDER = { worse: 0, same: 1, better: 2 };

/** @param {Report} r @param {string} status */
const count = (r, status) => r.findings.filter((f) => f.status === status).length;

/**
 * The rows, before and now. A higher number is better for the score, the phase, the share held
 * by a machine, the present and proven counts; lower is better for the rest.
 * @param {Report} now @param {Report | null} before @returns {DayRow[]}
 */
export function dayRows(now, before) {
  /** @type {[string, (r: Report) => number | null, boolean][]} label, reading, higher is better */
  const metrics = [
    ["score", (r) => r.score, true],
    ["phase held", (r) => r.phase?.held ?? null, true],
    ["present", (r) => count(r, "present"), true],
    ["partial", (r) => count(r, "partial"), false],
    ["missing", (r) => count(r, "missing"), false],
    ["held by a machine (%)", (r) => r.enforced?.share ?? null, true],
    ["proven by a control", (r) => r.truth?.proven ?? null, true],
    ["contradicted", (r) => r.truth?.contradicted ?? null, false],
    ["harness drift", (r) => (r.harness ? r.harness.drift + r.harness.missing : null), false],
    ["bypassed commits", (r) => r.bypass?.bypassed ?? null, false],
    ["floors raised", (r) => r.floors?.raised?.length ?? null, false],
  ];
  return metrics.map(([label, read, higher]) => {
    const n = read(now);
    const b = before ? read(before) : null;
    const change =
      b === null || n === null ? "new" : n === b ? "same" : n > b === higher ? "better" : "worse";
    return {
      label,
      before: b === null ? "-" : String(b),
      now: n === null ? "-" : String(n),
      change,
    };
  });
}

/**
 * The checks whose status moved between the two readings, worse first.
 * @param {Report} now @param {Report | null} before @returns {Moved[]}
 */
export function movedFindings(now, before) {
  if (!before) return [];
  const was = new Map(before.findings.map((f) => [f.id, f.status]));
  return now.findings
    .filter((f) => was.has(f.id) && was.get(f.id) !== f.status)
    .map((f) => {
      const from = String(was.get(f.id));
      const d = (RANK[f.status] ?? 0) - (RANK[from] ?? 0);
      /** @type {Moved["change"]} */
      const change = d > 0 ? "better" : d < 0 ? "worse" : "same";
      return { id: f.id, from, to: f.status, change };
    })
    .sort((a, b) => ORDER[a.change] - ORDER[b.change] || a.id.localeCompare(b.id));
}

/**
 * The reading to compare today's with: the newest dated one before today's date, or null.
 * @param {Report[]} all oldest first @param {string} today
 */
export function previousReading(all, today) {
  return [...all].reverse().find((r) => r.date < today) || null;
}
