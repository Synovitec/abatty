/**
 * Gate steps every code preset carries the same way. One definition, because a step spelled out
 * in five presets drifts the day one of them is edited.
 */
/**
 * The coverage of the changed lines (TEST.4), run by the gate and so by the pre-push hook, over
 * the gate's own range (the step reads it from ABATTY_RANGE). Held only by a separate CI step, it
 * let a push the local full gate passed go red in CI on two untested branches, after the session
 * had already reported the push green. Absent a script, the gate reports the step as not run.
 * @type {import("./index.mjs").GateStep}
 */
export const CHANGED_COVERAGE: import("./index.mjs").GateStep;
