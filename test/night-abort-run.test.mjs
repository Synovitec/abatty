// The aborts of a night under way: the harness moved, the agent crashing twice, a storm of
// denials. Each ends with its reason named and the branch local. Split from night-abort.test.mjs
// so the cases run beside it.
import { test } from "node:test";
import { abortCase } from "./night-helpers.mjs";

test("a harness moved during the night aborts it, the runner's own check alone", () => {
  // The runner's own detection of a moved harness, the layer above the sandbox: proven alone.
  abortCase(
    "night-tamper",
    { STUB_TAMPER: "1" },
    /harness moved before the wrap-up|harness moved before phase/,
    2,
    {
      sandbox: "off",
    },
  );
});

test("an agent that fails to run twice in a row ends the night", () => {
  abortCase("night-crash", { STUB_CRASH: "1" }, /failed to run twice in a row/, 2, {
    skipCanary: true,
  });
});

test("a storm of permission denials ends the night", () => {
  abortCase("night-denials", { STUB_DENIALS: "20" }, /20 permission denials/, 3, {
    skipCanary: true,
  });
});
