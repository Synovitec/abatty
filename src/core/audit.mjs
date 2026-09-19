/**
 * The dependency audit, scoped.
 *
 * An unscoped audit is the reason teams switch audits off. It reports a dev-only transitive
 * advisory nobody ships, at a severity nobody would act on, with no fix available, and it does it
 * on every push until somebody adds a flag that turns it off for good. So this one is scoped
 * three ways before it is allowed to refuse anything: production dependencies only, a severity
 * floor, and an allowance per advisory that carries a reason and a date.
 *
 * The date is the point. An advisory with no fix available is a real decision somebody has to
 * take, and taking it forever is not a decision. An allowance whose date has passed stops
 * allowing, the advisory comes back, and the gate says which allowance ran out.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/** @typedef {{ id: string, reason: string, until?: string }} Allowance */
/** @typedef {{ outcome: "ok" | "failed" | "skipped" | "deferred", detail: string, allowed?: string[], expired?: string[] }} AuditOutcome */

/** Severity, weakest first: the floor is an index into this. */
const SEVERITY = ["info", "low", "moderate", "high", "critical"];

/** The network is not a verdict: a registry that cannot be reached defers to CI, never fails. @param {string} out */
const offline = (out) =>
  /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|network|registry.*(unreachable|offline)/i.test(
    out,
  );

/**
 * The allowances that still allow, and the ones that have run out. An allowance with no date
 * never expires, which is a decision a reviewer can see in the config rather than a silence.
 * @param {Allowance[]} allow @param {string} today
 */
export function splitAllowances(allow, today) {
  const live = allow.filter((a) => a && a.id && (!a.until || a.until >= today));
  const expired = allow.filter((a) => a && a.id && a.until && a.until < today);
  return { live, expired };
}

/**
 * The advisories an `npm audit --json` report carries at or above the floor: one entry per
 * package, with every advisory id behind it, so an allowance may name either.
 * @param {string} json @param {string} floor
 * @returns {{ package: string, severity: string, ids: string[], title: string }[] | null}
 */
export function advisoriesOf(json, floor) {
  let report;
  try {
    report = JSON.parse(json);
  } catch {
    return null;
  }
  const vulns = report?.vulnerabilities;
  if (!vulns || typeof vulns !== "object") return null;
  const min = Math.max(0, SEVERITY.indexOf(floor));
  const out = [];
  for (const [name, v] of Object.entries(/** @type {Record<string, any>} */ (vulns))) {
    if (SEVERITY.indexOf(String(v?.severity)) < min) continue;
    // `via` mixes advisory objects with the names of the packages that pull them in; only the
    // objects carry an id, and an allowance may name either that id or the package above.
    const via = /** @type {any[]} */ (Array.isArray(v?.via) ? v.via : []).filter(
      (x) => x && typeof x === "object",
    );
    out.push({
      package: name,
      severity: String(v?.severity),
      ids: via.map((x) => String(x.source)),
      title: String(via[0]?.title || ""),
    });
  }
  return out;
}

/**
 * The audit as the gate runs it: production dependencies only, at or above the floor, less the
 * advisories this repository allows today. An allowance may name the package or the advisory id.
 * @param {string} repoDir
 * @param {(cmd: string, args: string[]) => { status: number | null, output: string }} run
 * @param {{ allow?: Allowance[], level?: string, today?: string }} [o]
 * @returns {AuditOutcome}
 */
export function auditOutcome(repoDir, run, o = {}) {
  if (
    !existsSync(join(repoDir, "package-lock.json")) &&
    !existsSync(join(repoDir, "npm-shrinkwrap.json"))
  )
    return { outcome: "skipped", detail: "no package-lock.json (an npm audit needs one)" };
  const level = SEVERITY.includes(String(o.level)) ? String(o.level) : "high";
  const today = o.today || new Date().toISOString().slice(0, 10);
  const { live, expired } = splitAllowances(o.allow || [], today);
  const expiredNote = expired.length
    ? `allowance(s) expired: ${expired.map((a) => `${a.id} on ${a.until}`).join(", ")}`
    : "";

  const r = run("npm", ["audit", "--audit-level=" + level, "--omit=dev"]);
  if (r.status === 0)
    return {
      outcome: "ok",
      detail: expiredNote,
      ...(expired.length ? { expired: ids(expired) } : {}),
    };
  if (offline(r.output))
    return { outcome: "deferred", detail: "the registry is unreachable; CI runs the audit" };
  if (!live.length) return failure(r.output, expiredNote);

  // Something is above the floor and this repository allows some of it: read the report properly
  // rather than guessing from the text, and fail on whatever is left.
  const json = run("npm", ["audit", "--json", "--omit=dev"]);
  const found = advisoriesOf(json.output, level);
  if (!found)
    return failure(
      r.output,
      `${expiredNote ? expiredNote + "; " : ""}the allowances could not be applied: npm audit --json was not readable`,
    );
  const names = new Set(live.map((a) => String(a.id)));
  const left = found.filter((f) => !names.has(f.package) && !f.ids.some((i) => names.has(i)));
  const allowed = found.filter((f) => names.has(f.package) || f.ids.some((i) => names.has(i)));
  if (left.length)
    return failure(
      left.map((f) => `${f.package} (${f.severity}) ${f.title}`).join("\n"),
      expiredNote,
    );
  return {
    outcome: "ok",
    // Allowed is never silent: the gate is green BECAUSE somebody decided, and the decision is
    // printed every time until its date passes.
    detail: [
      `allowed: ${allowed.map((f) => `${f.package} (${f.severity})`).join(", ")}`,
      expiredNote,
    ]
      .filter(Boolean)
      .join("; "),
    allowed: allowed.map((f) => f.package),
    ...(expired.length ? { expired: ids(expired) } : {}),
  };
}

/** @param {Allowance[]} list */
const ids = (list) => list.map((a) => String(a.id));

/** @param {string} output @param {string} note @returns {AuditOutcome} */
function failure(output, note) {
  const tail = String(output).split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
  return { outcome: "failed", detail: note ? `${note}\n${tail}` : tail };
}
