/**
 * The shape of a rule, checked: what a catalog, a profile and a repository's own rules file
 * are held to before a check of theirs runs.
 */

/** @typedef {import("./index.mjs").Rule} Rule */

/** The problems a rule list has, as messages; none for a well-formed catalog. @param {Rule[]} list */
export function validate(list) {
  /** @type {string[]} */
  const problems = [];
  const seen = new Set();
  for (const r of list) {
    const where = r?.id || "(no id)";
    if (!r || typeof r !== "object") problems.push("a rule is not an object");
    else {
      if (!/^[A-Z0-9]+-[A-Z0-9-]+$/.test(String(r.id || "")))
        problems.push(`${where}: id must be FAMILY-NAME in capitals`);
      if (seen.has(r.id)) problems.push(`${where}: duplicate id`);
      seen.add(r.id);
      for (const k of ["family", "title", "phase", "why", "next"])
        if (typeof (/** @type {any} */ (r)[k]) !== "string" || !(/** @type {any} */ (r)[k]))
          problems.push(`${where}: ${k} must be a non-empty string`);
      if (!["must", "should"].includes(r.level))
        problems.push(`${where}: level must be must|should`);
      if (!["hard", "ratchet", "review", "prose"].includes(r.enforcement))
        problems.push(`${where}: enforcement must be hard|ratchet|review|prose`);
      if (typeof r.check !== "function") problems.push(`${where}: check must be a function`);
      if (r.applies !== undefined && typeof r.applies !== "function")
        problems.push(`${where}: applies must be a function`);
      if (r.when !== undefined && typeof r.when !== "string")
        problems.push(`${where}: when must be a sentence`);
      if (
        r.stages !== undefined &&
        (!Array.isArray(r.stages) || !r.stages.every((s) => ["design", "build", "run"].includes(s)))
      )
        problems.push(`${where}: stages must be an array of design, build, run`);
      if (r.standard && !Array.isArray(r.standard))
        problems.push(`${where}: standard must be an array`);
    }
  }
  return problems;
}
