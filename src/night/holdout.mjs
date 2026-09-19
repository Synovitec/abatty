/**
 * The withheld surface (research 07 F8).
 *
 * A night is told which rules to work on, and then measured on those rules, which is the same
 * mistake as marking your own exam paper: an agent that fixes exactly what it was pointed at
 * scores perfectly and may have learned nothing about the standard. A slice of the checkable
 * surface is therefore withheld from the instruction, and the morning measures both. The gap
 * between them is the number that means something: work that generalised moves both, and work
 * that was fitted to the list moves one.
 *
 * What "withheld" honestly means here: withheld from the instruction, not hidden from the
 * repository. The tree is readable and a determined reader inside a session could find this file;
 * the claim is not containment, it is that the night's own instructions never name these rules,
 * so the agent has no reason to aim at them.
 */
import { createHash } from "node:crypto";

/**
 * A deterministic slice, by the hash of the rule's id against the night's seed. Deterministic so
 * two readings of the same night agree, seeded so two nights do not withhold the same rules and
 * a repository cannot quietly settle into passing the visible ones forever.
 * @param {string[]} ids @param {string} seed @param {number} [share] the fraction withheld
 * @returns {{ visible: string[], withheld: string[] }}
 */
export function splitSurface(ids, seed, share = 0.15) {
  const scored = ids
    .map((id) => ({
      id,
      n: parseInt(createHash("sha256").update(`${seed}\u0000${id}`).digest("hex").slice(0, 8), 16),
    }))
    .sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));
  const take = Math.max(1, Math.min(scored.length - 1, Math.round(scored.length * share)));
  const withheld = scored.slice(0, take).map((x) => x.id);
  const set = new Set(withheld);
  return { visible: ids.filter((id) => !set.has(id)), withheld: [...withheld].sort() };
}

/**
 * How each side of the split stands, and the gap between them. A rule that does not apply is not
 * counted on either side: a night cannot be credited or blamed for a rule that was never its
 * subject.
 * @param {{ id: string, status: string }[]} findings @param {{ visible: string[], withheld: string[] }} split
 */
export function holdoutGap(findings, split) {
  const by = new Map(findings.map((f) => [f.id, f.status]));
  /** @param {string[]} ids */
  const rate = (ids) => {
    const judged = ids.map((id) => by.get(id)).filter((s) => s && s !== "n/a" && s !== "waived");
    const held = judged.filter((s) => s === "present").length;
    return {
      judged: judged.length,
      held,
      pct: judged.length ? Math.round((100 * held) / judged.length) : 0,
    };
  };
  const visible = rate(split.visible);
  const withheld = rate(split.withheld);
  return {
    visible,
    withheld,
    // Positive means the visible side is ahead: the work followed the list. Around zero means it
    // followed the standard. Negative is noise, or a slice too small to read.
    gap: visible.pct - withheld.pct,
  };
}

/** The sentence the morning reads. @param {ReturnType<typeof holdoutGap>} g */
export const describeGap = (g) =>
  `visible ${g.visible.held}/${g.visible.judged} (${g.visible.pct}%) · withheld ${g.withheld.held}/${g.withheld.judged} (${g.withheld.pct}%) · gap ${g.gap > 0 ? "+" : ""}${g.gap} point(s)${
    g.withheld.judged < 3
      ? " · too few withheld rules to read anything into"
      : g.gap >= 20
        ? " · the work followed the list rather than the standard"
        : ""
  }`;
