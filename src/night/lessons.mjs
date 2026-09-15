/**
 * The heuristics of `abatty night-report`: what a night's facts propose as lessons. Each fires
 * on a recurrence (twice or more) or on a fact that is a lesson by itself (a crash, a denial
 * storm, a loosening refused, a failed canary). A proposal names its evidence and the check
 * that would catch it next time; a human accepts it into the lessons catalogue, or not.
 */

/**
 * @typedef {import("./report.mjs").NightReport} NightReport
 * @typedef {import("./report.mjs").Lesson} Lesson
 * @typedef {import("./report.mjs").BlockFact} BlockFact
 * @typedef {import("./report.mjs").DenialFact} DenialFact
 */

/** The shape of a denied command, without its particulars: the verb and its first flag. @param {string} what */
function shapeOf(what) {
  const m = what.trim().match(/^([\w.-]+(?:\s+[\w-]+)?)(?:\s+(--?[\w-]+))?/);
  return m ? [m[1], m[2]].filter(Boolean).join(" ") : what.slice(0, 40);
}

/**
 * The lessons a night's facts propose. Each heuristic fires on a recurrence (twice or more) or
 * on a fact that is a lesson by itself (a crash, twenty denials, a loosening refused).
 * @param {NightReport} f
 * @returns {Lesson[]}
 */
export function distil(f) {
  /** @type {Lesson[]} */
  const lessons = [];
  /** @param {Lesson} l */
  const add = (l) => lessons.push(l);

  // Stop-gate blocks recurring on the same check, from the blocks log (every block, not only
  // the last one a receipt keeps).
  /** @type {Record<string, BlockFact[]>} */
  const byCheck = {};
  for (const b of f.blocks) (byCheck[b.check] ||= []).push(b);
  for (const [check, list] of Object.entries(byCheck)) {
    const blocks = list.length;
    const sessionsHit = new Set(list.map((b) => b.sessionId)).size;
    if (blocks < 2) continue;
    const words = {
      tree: "the session tried to stop with uncommitted work; the skill's step ends in a commit, and the Stop gate is what enforced it",
      gate: "the gate went red at the stop; the brief before the first edit should name the step that is red most often, so the session runs it after each step, not at the end",
      changelog:
        "a source commit landed without its changelog line; the skill says one line per step in the same commit, the gate says it again",
      state:
        "the state file was not updated for the phase during the run; the skill's first step sets the phase to in_progress and commits it",
      direction:
        "something was loosened against the base and refused; the model reached for a threshold instead of the cause",
      harness:
        "the harness moved in the tree; a formatter or a tool touched it, and the restore is one command",
      branch: "the session left the adoption branch",
    };
    add({
      kind: "stop-gate",
      title: `the Stop gate blocked on "${check}" ${blocks} time(s) over ${sessionsHit} session(s)`,
      lesson:
        /** @type {Record<string, string>} */ (words)[check] ||
        `the Stop gate blocked on ${check} repeatedly`,
      check:
        check === "gate"
          ? "a gate step run after each step (the skill), or the step's tool as a lint-on-edit hook"
          : check === "tree" || check === "changelog"
            ? "the Stop gate, already; the skill's wording is what to sharpen"
            : "the Stop gate, already",
      evidence: list
        .slice(0, 6)
        .map((b) =>
          `${b.sessionId || "?"}${b.phase !== null ? " phase " + b.phase : ""} block ${b.block}: ${b.reason}`.slice(
            0,
            160,
          ),
        ),
      count: blocks,
    });
  }

  // Guard denials recurring on the same command shape.
  /** @type {Record<string, DenialFact[]>} */
  const byShape = {};
  for (const x of f.denials) (byShape[shapeOf(x.what)] ||= []).push(x);
  for (const [shape, list] of Object.entries(byShape)) {
    if (list.length < 2) continue;
    add({
      kind: "guard",
      title: `the guard refused "${shape}" ${list.length} times`,
      lesson: `the model reached for "${shape}" ${list.length} times in one night; the guard held, and the context file's non-negotiables should say why it is refused so the model stops trying`,
      check: "the guard, already; a line in the context file (§1) and the skill's traps",
      evidence: list
        .slice(0, 5)
        .map((x) => `${x.at.slice(11, 19)} ${x.tool}: ${x.what.slice(0, 100)}`),
      count: list.length,
    });
  }

  // Sessions: crashes, denial storms, no-ops, errors.
  const crashed = f.sessions.filter((s) => s.crashed);
  if (crashed.length)
    add({
      kind: "session",
      title: `${crashed.length} session(s) produced no result`,
      lesson:
        "the agent's CLI failed to run; the environment, not the phase, is what to fix before the next night (the runner retries once, then aborts)",
      check: "the runner's crash count; the canary before the first phase",
      evidence: crashed.map((s) => s.name),
      count: crashed.length,
    });
  const storms = f.sessions.filter((s) => s.denials >= 15);
  if (storms.length)
    add({
      kind: "session",
      title: `${storms.length} session(s) with fifteen or more permission denials`,
      lesson:
        "auto mode did not take in the headless session and every ordinary command was refused; rerun with mode dontAsk and explicit allow rules, and keep the canary on",
      check: "the runner's denial threshold (exit 3); the canary",
      evidence: storms.map((s) => `${s.name}: ${s.denials} denials`),
      count: storms.length,
    });
  const errors = f.sessions.filter((s) => s.isError && !s.crashed);
  if (errors.length)
    add({
      kind: "session",
      title: `${errors.length} session(s) reported an error`,
      lesson:
        "a session ended in an error the runner counted as a session; read its stderr before the next night",
      check: "the session's stderr under the night folder",
      evidence: errors.map((s) => s.name),
      count: errors.length,
    });

  // Phases blocked by the runner.
  for (const p of f.phases)
    if (p && p.status === "blocked")
      add({
        kind: "phase",
        title: `phase ${p.id} blocked: ${String(p.reason || "").slice(0, 80)}`,
        lesson: /no-op/.test(String(p.reason || ""))
          ? `phase ${p.id} produced sessions with no commit and no decision; a session that lands nothing must record why (decision: nothing-to-do or a blocker), or the phase's scope is not one the skill can start`
          : `phase ${p.id} was still open after the sessions allowed; the phase is too large for one night or a prerequisite is missing, and the plan's traps for it should say which`,
        check:
          "the runner's sessions-per-phase cap; the plan's phase entry (split it, or name the prerequisite)",
        evidence: [String(p.reason || "")],
        count: 1,
      });

  // Decisions recurring by code.
  for (const [code, n] of Object.entries(f.decisions)) {
    if (n < 2) continue;
    const words = {
      "harness-change":
        "the worker needed a change to the harness or the config more than once; the value it needed belongs in the config template or the phase's prerequisites",
      "seam-unclear":
        "the seam to split on was unclear more than once; the boundary map in the context file (§3) is not precise enough for the files of this phase",
      "behaviour-risk":
        "a step was undone for behaviour risk more than once; the phase lacks the tests that would make the change safe, which is a phase to run first",
      "second-reader-skipped":
        "the reviewer agent was skipped more than once; the budget or the time cap is too tight for the review step",
      "step-restored":
        "a half-done step was found and restored more than once; a session is ending mid-step, which is the time cap or the block cap",
    };
    add({
      kind: "decision",
      title: `decision: ${code} recorded ${n} times`,
      lesson:
        /** @type {Record<string, string>} */ (words)[code] ||
        `decision: ${code} recurs; the situation it answers should be answered once, in the context file's decision table`,
      check: "the decision table (context file §9); the decisions file is the evidence",
      evidence: [`${n} bullets in the decisions file`],
      count: n,
    });
  }

  // The direction check's findings at the push.
  if (f.direction.length)
    add({
      kind: "direction",
      title: `${f.direction.length} finding(s) at the direction check`,
      lesson:
        "something differed from the base or was loosened when the runner judged the push; the branch stayed local, and the finding names what to restore or to decide",
      check: "check-direction.mjs, already; the decisions file for a deliberate exemption",
      evidence: f.direction.slice(0, 6),
      count: f.direction.length,
    });

  // The canary.
  if (f.canary.ok === false)
    add({
      kind: "canary",
      title: "the canary reported an error",
      lesson:
        "the pre-flight session did not run as the night flags require; nothing after it can be trusted until it passes",
      check: "the canary, already",
      evidence: ["canary.json"],
      count: 1,
    });

  return lessons;
}
