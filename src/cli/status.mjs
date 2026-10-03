/**
 * The `status` screen: the repository at a glance (the newest report, measured now when there
 * is none or on --fresh), the harness, the workspaces, the stage, the nights, what to do next.
 * Kept out of the dispatcher so the dispatcher stays under the cap it enforces.
 */
import { buildReport, latestReport } from "../core/report.mjs";
import * as t from "../ui/term.mjs";
import { git } from "../core/repo.mjs";
import { fixFirst } from "../core/fix-first.mjs";
import { phaseOf, reopened } from "../rules/phases.mjs";
import { readJsonFile } from "../core/repo.mjs";
import { CONTROLS_FILE, currentControls } from "../core/step-controls.mjs";

/**
 * @param {import("./ratchet.mjs").CliContext} c
 * @param {import("../presets/index.mjs").Preset | null} preset the repository's root preset, or none
 */
export async function statusCommand(c, preset) {
  const { dir, flag, out, VERSION } = c;
  // The repository at a glance: the newest report (measured now when there is none, or on
  // --fresh), the harness, the nights, what to do next.
  const known = latestReport(dir);
  // A reading of another commit is measured again: shown with a "stale" mark, it still had to be
  // asked for with --fresh, and an adopter read the old numbers first. Same commit, the reading
  // stands and status stays instant.
  const moved =
    Boolean(known) &&
    (known?.commit !== git(dir, "rev-parse", "--short", "HEAD") ||
      known?.branch !== git(dir, "rev-parse", "--abbrev-ref", "HEAD"));
  // A reading another version measured is measured again, as one of another commit is: right
  // after an update, the screen showed the old version's numbers and did not say whose they were.
  const other = known && known.abatty && known.abatty !== VERSION ? String(known.abatty) : "";
  const fresh = flag("--fresh") || !known || moved || Boolean(other);
  const r = fresh || !known ? await buildReport(dir, { abattyVersion: VERSION }) : known;
  const present = r.findings.filter((f) => f.status === "present").length;
  const partial = r.findings.filter((f) => f.status === "partial").length;
  const missing = r.findings.filter((f) => f.status === "missing").length;
  // The reading shown is always of this checkout: one of another commit was measured again
  // above, so its branch and commit are the ones checked out.
  const when = fresh
    ? moved
      ? `measured now · the last reading was of ${known?.branch} @ ${known?.commit}`
      : other
        ? `measured now · the last reading was abatty ${other}'s`
        : "measured now"
    : `reading of ${r.date} · --fresh to measure`;
  out(
    `\n${t.banner(VERSION)}  ${t.bold(r.name)} ${t.gray(`${r.branch} @ ${r.commit}`)}  ${t.gray(when)}\n\n`,
  );
  out(
    phaseLine(r) +
      `  ${t.gray(`${r.applicable} checks · `)}${t.green(present + " present")} ${t.gray("·")} ${t.yellow(partial + " partial")} ${t.gray("·")} ${t.red(missing + " missing")}\n\n`,
  );
  out(enforcedLine(r.enforced) + "\n\n");
  out(fixFirstBlock(dir, r.findings));
  out(familyTable(r.families) + "\n");
  out(t.heading("Harness"));
  // The policy and its proof first: which standard the reading is against, and whether the gate's
  // steps were last seen able to fail. Two reviews asked for one screen that says both.
  out(
    t.kv(
      "policy",
      `${(r.profiles || []).join(", ") || "minimal"}${t.gray(` · ${r.applicable} checks · abatty rules`)}`,
    ) + "\n",
  );
  out(t.kv("proof", proofSays(dir)) + "\n");
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
    // The coding-agent harness, not the git hooks: under the minimal profile there is none by
    // choice, and "hooks missing · abatty init" read as init having failed at what it had done.
    t.kv(
      "agent harness",
      r.harness.present
        ? r.harness.drift || r.harness.missing
          ? t.status("differs") +
            t.gray(` · ${r.harness.drift} differ, ${r.harness.missing} missing`)
          : t.status("in step")
        : t.gray("none · init --agent <id> adds one"),
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
  out(
    `\n${t.gray("abatty prove · measure · gate · doctor · scrub · dashboard --open · help")}\n\n`,
  );
}

/**
 * The per-family table the status screen and `measure` both print: one table, so the two screens
 * cannot drift into counting the families differently. `measure` adds the not-applicable column.
 * @param {{ name: string, present: number, partial: number, missing: number, na: number }[]} families
 * @param {{ na?: boolean }} [o]
 */
export function familyTable(families, o = {}) {
  const head = ["family", "", "present", "partial", "missing", ...(o.na ? ["n/a"] : [])];
  const rows = families.map((f) => [
    f.name,
    t.stacked(f.present, f.partial, f.missing, 16),
    String(f.present),
    String(f.partial),
    String(f.missing),
    ...(o.na ? [String(f.na)] : []),
  ]);
  /** @type {("l" | "r")[]} */
  const align = ["l", "l", ...head.slice(2).map(() => /** @type {const} */ ("r"))];
  return t.table([head, ...rows], { align });
}

/**
 * The enforced share for a screen: how much of what the repository has is held by a machine.
 * @param {import("../core/gap-analysis.mjs").Enforced | undefined} e
 */
export function enforcedLine(e) {
  if (!e || e.share === null) return `  ${t.gray("enforced: nothing present yet")}`;
  const colour = e.share >= 90 ? t.green : e.share >= 70 ? t.yellow : t.red;
  return `  ${t.bar(e.share)}  ${t.bold(colour(e.share + "%"))} ${t.gray(`of ${e.total} present rules held by a machine · ${e.hard} hard · ${e.ratchet} ratchet · ${e.review} review · ${e.prose} prose${e.promotable.length ? " · next up a level: " + e.promotable.slice(0, 3).join(", ") : ""}${(e.atCeiling || []).length ? " · " + (e.atCeiling || []).length + " at the machine ceiling" : ""}`)}`;
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
 *
 * A phase the adoption already closed and new rules reopened is said to be that, never day 0.
 * @param {{ phase: { id: string, title: string, held: number, applicable: number } | null, score: number, applicable: number, plan?: { id: string }[], night?: { state: unknown }, findings?: import("../rules/index.mjs").Finding[] }} r
 */
export function phaseLine(r) {
  const trend = `  ${t.gray(`${r.score}/100 over ${r.applicable} applicable checks · a trend, not a grade`)}\n`;
  if (!r.phase) return `  ${t.bar(100)}  ${t.bold("every phase of the plan is held")}\n` + trend;
  const p = r.phase;
  const pct = p.applicable ? Math.round((100 * p.held) / p.applicable) : 0;
  return (
    `  ${t.bar(pct)}  ${t.bold(`phase ${p.id}`)} ${t.gray("·")} ${t.bold(`${p.held} of ${p.applicable} held`)}\n` +
    `  ${t.gray(p.title)}\n` +
    reopenedLine(r) +
    trend
  );
}

/** The line under a phase the adoption closed and new rules reopened, or nothing. @param {Parameters<typeof phaseLine>[0]} r */
function reopenedLine(r) {
  const again = reopened(
    r.phase,
    (r.plan || []).map((p) => String(p.id)),
    r.night?.state,
    r.findings || [],
  );
  if (!again) return "";
  const when = again.closedAt ? ` by ${again.closedAt}` : "";
  return `  ${t.yellow(`reopened: the adoption closed this phase${when}; ${again.by.length} rule(s) unmet since, new to the catalog or regressed`)}${again.by.length ? t.gray(` · ${again.by.join(", ")}`) : ""}\n`;
}

/**
 * The "fix these first" block, above everything else a reading shows: secrets in the tree, the
 * last gate's failed audit, the must-level Security rules missing (src/core/fix-first.mjs). An
 * adopter's first report led with documents while two critical advisories waited.
 * @param {string} dir @param {import("../rules/index.mjs").Finding[]} findings @returns {string}
 */
export function fixFirstBlock(dir, findings) {
  const lines = fixFirst(dir, findings);
  // Silent when clean read the same as a check that never ran; one line says it did.
  if (!lines.length)
    return `  ${t.glyph.ok} ${t.gray("Security: nothing to fix first (no secret in the tree, the last audit green or run in CI, no Security must missing)")}\n\n`;
  return `${t.heading("Fix these first", "security, before structure and docs")}${lines.map((l) => `  ${t.glyph.fail} ${t.red(l)}\n`).join("")}\n`;
}

/**
 * What the last controls run proved, for the status screen: how many of the steps it judged went
 * red on their plant, which stayed green, and when, or that none has run.
 * @param {string} dir @returns {string}
 */
function proofSays(dir) {
  /** @type {{ at?: string, abatty?: string, steps?: { label: string, outcome: string }[] } | null} */
  const recorded = readJsonFile(dir, CONTROLS_FILE);
  if (!recorded)
    return t.gray("none yet · abatty prove shows it on a copy, doctor --controls records it");
  if (!currentControls(recorded))
    return (
      t.yellow(`planted by abatty ${recorded.abatty || "(unrecorded)"}`) +
      t.gray(" · abatty doctor --controls runs them again")
    );
  const steps = recorded.steps || [];
  const red = steps.filter((x) => x.outcome === "red").length;
  const green = steps.filter((x) => x.outcome === "green").map((x) => x.label);
  const when = String(recorded.at || "").slice(0, 10);
  return (
    (green.length
      ? t.red(`${green.length} step(s) stayed green: ${green.join(", ")}`) + t.gray(" · ")
      : "") +
    `${red} of ${red + green.length} judged step(s) went red on their plant` +
    t.gray(when ? ` · ${when}` : "")
  );
}
