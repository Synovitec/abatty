/**
 * The `status` screen: the repository at a glance (the newest report, measured now when there
 * is none or on --fresh), the harness, the workspaces, the stage, the nights, what to do next.
 * Kept out of the dispatcher so the dispatcher stays under the cap it enforces.
 */
import { buildReport, latestReport } from "../core/report.mjs";
import * as t from "../ui/term.mjs";

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
    `  ${t.bar(r.score)}  ${t.bold(String(r.score))}${t.gray("/100")}  ${t.gray(`${r.applicable} checks · `)}${t.green(present + " present")} ${t.gray("·")} ${t.yellow(partial + " partial")} ${t.gray("·")} ${t.red(missing + " missing")}\n\n`,
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
const phaseOrder = (p) => {
  const m = String(p).match(/\d+/);
  return m ? Number(m[0]) : 99;
};
/** The next steps of a report, in plan order. @param {import("../core/report.mjs").Report} r @param {number} n */
export const nextSteps = (r, n) =>
  r.findings
    .filter((f) => f.status === "missing" || f.status === "partial")
    // Plan order, and within a phase the must rules before the should ones.
    .sort(
      (a, b) =>
        phaseOrder(a.phase) - phaseOrder(b.phase) ||
        (a.level === "should" ? 1 : 0) - (b.level === "should" ? 1 : 0),
    )
    .slice(0, n);
