/**
 * The `status` screen: the repository at a glance (the newest report, measured now when there
 * is none or on --fresh), the harness, the workspaces, the stage, the nights, what to do next.
 * Kept out of the dispatcher so the dispatcher stays under the cap it enforces.
 */
import { buildReport, latestReport } from "../core/report.mjs";
import * as t from "../ui/term.mjs";
import { phaseOf } from "../rules/phases.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} c
 * @param {import("../presets/index.mjs").Preset | null} preset the repository's root preset, or none
 */
export async function statusCommand(c, preset) {
  const { dir, flag, out, VERSION } = c;
  // The repository at a glance: the newest report (measured now when there is none, or on
  // --fresh), the harness, the nights, what to do next.
  const known = latestReport(dir);
  const fresh = flag("--fresh") || !known;
  const r = fresh || !known ? await buildReport(dir, { abattyVersion: VERSION }) : known;
  const present = r.findings.filter((f) => f.status === "present").length;
  const partial = r.findings.filter((f) => f.status === "partial").length;
  const missing = r.findings.filter((f) => f.status === "missing").length;
  out(
    `\n${t.banner(VERSION)}  ${t.bold(r.name)} ${t.gray(`${r.branch} @ ${r.commit}`)}  ${t.gray(fresh ? "measured now" : `reading of ${r.date} · --fresh to measure`)}\n\n`,
  );
  out(
    phaseLine(r) +
      `  ${t.gray(`${r.applicable} checks · `)}${t.green(present + " present")} ${t.gray("·")} ${t.yellow(partial + " partial")} ${t.gray("·")} ${t.red(missing + " missing")}\n\n`,
  );
  out(enforcedLine(r.enforced) + "\n\n");
  out(
    t.table(
      [
        ["family", "", "present", "partial", "missing"],
        ...r.families.map((f) => [
          f.name,
          t.stacked(f.present, f.partial, f.missing, 16),
          String(f.present),
          String(f.partial),
          String(f.missing),
        ]),
      ],
      { align: ["l", "l", "r", "r", "r"] },
    ) + "\n",
  );
  out(t.heading("Harness"));
  out(
    t.kv(
      "stack",
      preset
        ? `${preset.name}${preset.proven ? "" : t.yellow(" (unproven preset)")}`
        : t.yellow("none detected"),
    ) + "\n",
  );
  if (r.workspaces?.length)
    out(
      t.kv(
        "workspaces",
        r.workspaces
          .map(
            (w) =>
              `${w.path} ${w.preset ? t.gray(w.preset + (w.from === "config" ? "" : " (detected)")) : t.yellow("no preset · not gated; name one in the config → workspaces")}`,
          )
          .join("\n" + " ".repeat(17)),
      ) + "\n",
    );
  out(
    t.kv(
      "stage",
      r.stage
        ? `${r.stage}${r.stageFrom === "config" ? "" : t.gray(" · read from the tree; name it in the config → stage")}`
        : t.gray("not in this reading · --fresh"),
    ) + "\n",
  );
  out(
    t.kv(
      "hooks",
      r.harness.present
        ? r.harness.drift || r.harness.missing
          ? t.status("differs") +
            t.gray(` · ${r.harness.drift} differ, ${r.harness.missing} missing`)
          : t.status("in step")
        : t.status("missing") + t.gray(" · abatty init"),
    ) + "\n",
  );
  out(
    r.scrub.enabled
      ? t.kv(
          "no trace",
          r.scrub.lines === 0
            ? t.green("clean")
            : t.red(`${r.scrub.lines} line(s) name a tool`) + t.gray(" · abatty scrub"),
        ) + "\n"
      : t.kv("provenance", t.green("kept") + t.gray(" · the scrub is off (scrub.enabled)")) + "\n",
  );
  const state = /** @type {{ phases?: { status?: string }[] } | null} */ (r.night.state);
  const phases = Array.isArray(state?.phases) ? state.phases : [];
  out(
    t.kv(
      "nights",
      phases.length
        ? `${phases.filter((p) => p.status === "done").length}/${phases.length} phases done · ${r.night.decisions} decision(s)${r.night.lastReport ? " · " + r.night.lastReport : ""}`
        : t.gray("none yet"),
    ) + "\n",
  );
  if (r.waived) out(t.kv("waived", `${r.waived} rule(s) set aside with a reason`) + "\n");
  for (const p of r.problems || []) out(`  ${t.glyph.warn} ${t.yellow(p)}\n`);
  const next = nextSteps(r, 5);
  if (next.length) {
    out(t.heading("Next", "in plan order, must before should · abatty explain <ID>"));
    for (const f of next)
      out(
        `  ${t.gray("phase " + String(f.phase).padEnd(4))} ${t.bold(f.id)} ${t.gray((f.level || "").padEnd(6))} ${t.gray(f.next.slice(0, 84))}\n`,
      );
  }
  out(`\n${t.gray("abatty measure · gate · doctor · scrub · dashboard --open · help")}\n\n`);
}

/**
 * The enforced share for a screen: how much of what the repository has is held by a machine.
 * @param {import("../core/gap-analysis.mjs").Enforced | undefined} e
 */
export function enforcedLine(e) {
  if (!e || e.share === null) return `  ${t.gray("enforced: nothing present yet")}`;
  const colour = e.share >= 90 ? t.green : e.share >= 70 ? t.yellow : t.red;
  return `  ${t.bar(e.share)}  ${t.bold(colour(e.share + "%"))} ${t.gray(`of ${e.total} present rules held by a machine · ${e.hard} hard · ${e.ratchet} ratchet · ${e.review} review · ${e.prose} prose${e.promotable.length ? " · next up a level: " + e.promotable.slice(0, 3).join(", ") : ""}`)}`;
}

/** Phase "0" sorts first, "A.1 / 0" by its number, "-" last. @param {string} p */
/**
 * The next steps of a report, in the plan's own order. The report carries the plan, so the
 * order comes from it rather than from the first number in the phase: that read "A.1" as 1 and
 * listed the whole of phase 0 ahead of the day-0 work that blocks it.
 * @param {import("../core/report.mjs").Report} r @param {number} n
 */
export const nextSteps = (r, n) => {
  const order = (r.plan || []).map((p) => String(p.id));
  const rank = (/** @type {string} */ p) => {
    const id = phaseOf(p, order);
    return id === null ? order.length : order.indexOf(id);
  };
  return (
    r.findings
      .filter((f) => f.status === "missing" || f.status === "partial")
      // Plan order, and within a phase the must rules before the should ones.
      .sort(
        (a, b) =>
          rank(a.phase) - rank(b.phase) ||
          (a.level === "should" ? 1 : 0) - (b.level === "should" ? 1 : 0),
      )
      .slice(0, n)
  );
};

/**
 * The headline: the phase the repository is ON and its standing, which is the number a reader
 * can act on this week. The score over the whole catalog follows as a trend, labelled as one.
 *
 * A fresh application is missing the later phases by design - of the rules one was missing on
 * 2026-09-18, six were phase 0 and seventeen were phases the plan puts after it - so a
 * percentage that counts them reads as a verdict on work nobody was asked to do yet, and the
 * first impression a stranger gets is a failure they did not earn.
 * @param {{ phase: { id: string, title: string, held: number, applicable: number } | null, score: number, applicable: number }} r
 */
export function phaseLine(r) {
  const trend = `  ${t.gray(`${r.score}/100 over ${r.applicable} applicable checks · a trend, not a grade`)}\n`;
  if (!r.phase) return `  ${t.bar(100)}  ${t.bold("every phase of the plan is held")}\n` + trend;
  const p = r.phase;
  const pct = p.applicable ? Math.round((100 * p.held) / p.applicable) : 0;
  return (
    `  ${t.bar(pct)}  ${t.bold(`phase ${p.id}`)} ${t.gray("·")} ${t.bold(`${p.held} of ${p.applicable} held`)}\n` +
    `  ${t.gray(p.title)}\n` +
    trend
  );
}
