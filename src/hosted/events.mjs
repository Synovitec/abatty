/**
 * Adoption events: what CHANGED between two readings of the same repository.
 *
 * A wall of scores tells an adopter nothing they can act on and nothing they can show anybody.
 * "On the 14th, CODE-SIZE-300 went from missing to present; on the 15th, FLOW-COMMITS was
 * promoted from a checklist item to something a machine refuses" is the adoption story, and it
 * is the thing a team reads once a month rather than a number they stop looking at.
 *
 * Every event is derived from two reports the service already holds, so nothing new is collected
 * and nothing is self-reported: a repository cannot tell the service it adopted something.
 *
 * Losses are events too, and they are not softened. A rule that was present and is now missing
 * is the single most useful line this log can carry, and a log that only recorded progress would
 * be an advertisement for its own tool.
 */

/** The enforcement ladder, weakest first: a move up it is an event. */
const LADDER = ["prose", "review", "ratchet", "hard"];

/** @typedef {{ at: string, kind: string, subject: string, from?: string, to?: string, detail: string }} AdoptionEvent */

/** @param {any} report @returns {Map<string, any>} */
const findingsOf = (report) =>
  new Map(
    /** @type {any[]} */ (Array.isArray(report?.findings) ? report.findings : []).map((f) => [
      f.id,
      f,
    ]),
  );

/**
 * The events between two readings. `prev` null means the first reading, which is one event of
 * its own rather than a hundred "this rule appeared" lines nobody would read.
 * @param {any | null} prev
 * @param {any} next
 * @returns {AdoptionEvent[]}
 */
export function eventsBetween(prev, next) {
  const at = String(next?.date || "");
  if (!prev)
    return [
      {
        at,
        kind: "first-reading",
        subject: String(next?.name || ""),
        detail: `first reading: ${next?.score ?? "?"}/100 over ${next?.applicable ?? "?"} applicable check(s)`,
      },
    ];
  /** @type {AdoptionEvent[]} */
  const events = [];
  const before = findingsOf(prev);
  const after = findingsOf(next);

  for (const [id, f] of after) {
    const was = before.get(id);
    if (!was) {
      events.push({
        at,
        kind: "rule-added",
        subject: id,
        to: f.status,
        detail: `${id} entered the catalog, reading ${f.status}`,
      });
      continue;
    }
    if (was.status !== f.status) {
      const held = f.status === "present";
      const lost = was.status === "present";
      events.push({
        at,
        kind: held ? "rule-held" : lost ? "rule-lost" : "rule-moved",
        subject: id,
        from: was.status,
        to: f.status,
        // A loss says what it costs; a gain says what it is. Neither is dressed up.
        detail: lost
          ? `${id} was present and now reads ${f.status}: ${f.evidence || "no evidence given"}`
          : `${id} moved ${was.status} to ${f.status}`,
      });
    }
    const up = LADDER.indexOf(f.enforcement) - LADDER.indexOf(was.enforcement);
    if (LADDER.includes(f.enforcement) && LADDER.includes(was.enforcement) && up !== 0)
      events.push({
        at,
        kind: up > 0 ? "rule-promoted" : "rule-demoted",
        subject: id,
        from: was.enforcement,
        to: f.enforcement,
        detail: `${id} is now insured by ${f.enforcement}, was ${was.enforcement}`,
      });
    const wasWaived = was.status === "waived";
    const isWaived = f.status === "waived";
    if (!wasWaived && isWaived)
      events.push({ at, kind: "waived", subject: id, detail: `${id} set aside: ${f.evidence}` });
    if (wasWaived && !isWaived)
      events.push({
        at,
        kind: "waiver-ended",
        subject: id,
        to: f.status,
        detail: `${id} is measured again and reads ${f.status}`,
      });
  }
  for (const [id] of before)
    if (!after.has(id))
      events.push({
        at,
        kind: "rule-removed",
        subject: id,
        detail: `${id} left the catalog: a rule that stops being checked stops being held`,
      });

  const wasPhase = prev?.phase?.id;
  const isPhase = next?.phase?.id;
  if (wasPhase && isPhase && wasPhase !== isPhase)
    events.push({
      at,
      kind: "phase",
      subject: String(isPhase),
      from: String(wasPhase),
      to: String(isPhase),
      detail: `phase ${wasPhase} to ${isPhase}`,
    });
  return events;
}

/**
 * Every event across a repository's readings, oldest first. Derived on read rather than stored,
 * so a bug in the derivation is fixed by deploying rather than by rewriting a log.
 * @param {any[]} reports oldest first
 */
export function eventsOf(reports) {
  /** @type {AdoptionEvent[]} */
  const out = [];
  for (let i = 0; i < reports.length; i++)
    out.push(...eventsBetween(i === 0 ? null : reports[i - 1], reports[i]));
  return out;
}

/** What the log says at a glance: how many of each kind, losses counted separately. @param {AdoptionEvent[]} events */
export function summariseEvents(events) {
  /** @type {Record<string, number>} */
  const kinds = {};
  for (const e of events) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return {
    total: events.length,
    kinds,
    // Named on its own because it is the number an adopter should look at first and the one a
    // dashboard is most tempted to bury.
    regressions: (kinds["rule-lost"] || 0) + (kinds["rule-demoted"] || 0),
  };
}
