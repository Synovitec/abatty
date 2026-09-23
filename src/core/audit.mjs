/**
 * The dependency audit, scoped.
 *
 * An unscoped audit is the reason teams switch audits off. It reports a dev-only transitive
 * advisory nobody ships, at a severity nobody would act on, with no fix available, and it does it
 * on every push until somebody adds a flag that turns it off for good. So this one is scoped
 * three ways before it is allowed to refuse anything: production dependencies only, a severity
 * floor, and an allowance per advisory that carries a reason and a date. It runs the audit of
 * the package manager the repository committed (src/core/package-manager.mjs), not npm's.
 *
 * The date is the point. An advisory with no fix available is a real decision somebody has to
 * take, and taking it forever is not a decision. An allowance whose date has passed stops
 * allowing, the advisory comes back, and the gate says which allowance ran out.
 */
import { localToday } from "./today.mjs";
import { packageManager } from "./package-manager.mjs";

/** @typedef {{ id: string, reason: string, until?: string }} Allowance */
/** @typedef {{ outcome: "ok" | "failed" | "errored" | "deferred", detail: string, allowed?: string[], expired?: string[] }} AuditOutcome */
/** @typedef {{ package: string, severity: string, ids: string[], title: string }} Advisory */

/** Severity, weakest first: the floor is an index into this. */
const SEVERITY = ["info", "low", "moderate", "high", "critical"];

/**
 * The network is not a verdict: a registry that cannot be reached defers to CI, never fails. Read
 * by the error codes a failed connection prints. The bare word "network" was on this list, and an
 * advisory about a network (a request forgery, say) then read as an unreachable registry: a high
 * advisory deferred, which the gate counts as a pass.
 * @param {string} out
 */
const offline = (out) =>
  /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|ECONNRESET|registry.*(unreachable|offline)/i.test(
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
 * The advisories an audit's JSON report carries at or above the floor: one entry per package,
 * with every advisory id behind it, so an allowance may name either. Three shapes, each read
 * from a real run: npm 7+ (`vulnerabilities` by package, the advisories under `via`), pnpm (the
 * registry's own bulk response, `advisories` by id with `module_name`) and bun (packages as
 * keys, an array of advisories each). A banner before the JSON (bun prints one) is skipped. Both
 * yarns print one record per line instead, read first (`linesOf`).
 * @param {string} json @param {string} floor
 * @returns {Advisory[] | null}
 */
export function advisoriesOf(json, floor) {
  const min = Math.max(0, SEVERITY.indexOf(floor));
  const aboveFloor = (/** @type {Advisory} */ a) => SEVERITY.indexOf(a.severity) >= min;
  const lines = linesOf(json);
  if (lines) return lines.filter(aboveFloor);
  let report;
  try {
    report = JSON.parse(firstDocument(String(json)));
  } catch {
    return null;
  }
  if (!report || typeof report !== "object") return null;
  const vulns = report.vulnerabilities;
  if (vulns && typeof vulns === "object") {
    const out = [];
    for (const [name, v] of Object.entries(/** @type {Record<string, any>} */ (vulns))) {
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
    return out.filter(aboveFloor);
  }
  const advisories = report.advisories;
  if (advisories && typeof advisories === "object") {
    /** @type {Map<string, Advisory>} */
    const byPackage = new Map();
    for (const [id, a] of Object.entries(/** @type {Record<string, any>} */ (advisories))) {
      const name = String(a?.module_name || "");
      const entry = byPackage.get(name) || { package: name, severity: "info", ids: [], title: "" };
      entry.ids.push(String(a?.id ?? id));
      if (SEVERITY.indexOf(String(a?.severity)) > SEVERITY.indexOf(entry.severity)) {
        entry.severity = String(a?.severity);
        entry.title = String(a?.title || "");
      }
      byPackage.set(name, entry);
    }
    return [...byPackage.values()].filter(aboveFloor);
  }
  const entries = Object.entries(report);
  if (entries.every(([, v]) => Array.isArray(v))) {
    return entries
      .map(([name, list]) => {
        const worst = /** @type {any[]} */ (list).reduce(
          (w, a) => (SEVERITY.indexOf(String(a?.severity)) > SEVERITY.indexOf(w.severity) ? a : w),
          { severity: "info", title: "" },
        );
        return {
          package: name,
          severity: String(worst.severity),
          ids: /** @type {any[]} */ (list).map((a) => String(a?.id)),
          title: String(worst.title || ""),
        };
      })
      .filter(aboveFloor);
  }
  return null;
}

/**
 * The JSON document that opens at the first `{`, up to the brace that closes it, whatever is
 * printed before or after. bun prints a banner on stderr after its report, and reading to the end
 * of the output made every bun report unreadable, so an allowance could never apply there.
 * @param {string} text
 */
function firstDocument(text) {
  const start = text.indexOf("{");
  if (start < 0) return text;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
    } else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

/**
 * The advisories of an audit that prints one JSON record per line, both yarns' form, or null when
 * the output is not that form. yarn 1 writes `auditAdvisory` records and a closing
 * `auditSummary` (the only line when nothing was found, which is an empty list, not an
 * unreadable report); yarn berry writes `{ value: <package>, children: { ID, Issue, Severity } }`.
 * @param {string} text @returns {Advisory[] | null}
 */
function linesOf(text) {
  /** @type {any[]} */
  const records = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  const classic = records.some((r) => r?.type === "auditSummary" || r?.type === "auditAdvisory");
  const berry = records.length > 0 && records.every((r) => r?.children && "value" in r);
  if (!classic && !berry) return null;
  /** @type {Map<string, Advisory>} */
  const byPackage = new Map();
  for (const r of records) {
    const a = classic ? r?.data?.advisory : r?.children;
    if (classic && r?.type !== "auditAdvisory") continue;
    const name = String(classic ? a?.module_name : r.value);
    const severity = String(classic ? a?.severity : a?.Severity).toLowerCase();
    const entry = byPackage.get(name) || { package: name, severity: "info", ids: [], title: "" };
    entry.ids.push(String(classic ? a?.id : a?.ID));
    if (classic && a?.github_advisory_id) entry.ids.push(String(a.github_advisory_id));
    if (SEVERITY.indexOf(severity) > SEVERITY.indexOf(entry.severity)) {
      entry.severity = severity;
      entry.title = String(classic ? a?.title || "" : a?.Issue || "");
    }
    byPackage.set(name, entry);
  }
  return [...byPackage.values()];
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
  // A repository that committed no lockfile has no install that was tested and nothing an audit
  // can read: the instrument is missing, and a missing instrument is red, not a step skipped on a
  // green run. This was "skipped" once, which is how a product with seventy advisories had a
  // gate that said nothing about them.
  const pm = packageManager(repoDir);
  if (!pm)
    return {
      outcome: "errored",
      detail:
        "no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock or bun.lock): an audit reads one, and an install without one is not the install that was tested (SEC.1)",
    };
  if (!pm.audit)
    return {
      outcome: "deferred",
      detail: `${pm.id}'s audit is not wired in this version of abatty; CI runs \`${pm.auditCommand}\``,
    };
  const level = SEVERITY.includes(String(o.level)) ? String(o.level) : "high";
  const cmd = pm.audit(level);
  const today = o.today || localToday();
  const { live, expired } = splitAllowances(o.allow || [], today);
  const expiredNote = expired.length
    ? `allowance(s) expired: ${expired.map((a) => `${a.id} on ${a.until}`).join(", ")}`
    : "";

  const r = run(String(cmd.check[0]), cmd.check.slice(1));
  // A manager whose exit code does not honour the floor is judged from its report alone.
  const clean = cmd.byJson ? advisoriesOf(r.output, level)?.length === 0 : r.status === 0;
  if (clean)
    return {
      outcome: "ok",
      detail: expiredNote,
      ...(expired.length ? { expired: ids(expired) } : {}),
    };
  // A report that parsed was delivered by the registry, whatever its advisories say.
  if (offline(r.output) && !(cmd.byJson && advisoriesOf(r.output, level)))
    return { outcome: "deferred", detail: "the registry is unreachable; CI runs the audit" };
  if (!live.length && !cmd.byJson) return failure(r.output, expiredNote);

  // Something is above the floor and this repository allows some of it: read the report properly
  // rather than guessing from the text, and fail on whatever is left.
  const json = cmd.byJson ? r : run(String(cmd.json[0]), cmd.json.slice(1));
  const found = advisoriesOf(json.output, level);
  if (!found)
    return failure(
      r.output,
      `${expiredNote ? expiredNote + "; " : ""}the allowances could not be applied: ${cmd.json.join(" ")} was not readable`,
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
