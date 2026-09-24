// The canary's refusals: a night starts only once the guard, the Stop hook and the MCP boundary
// have each been seen to hold. Split from night-abort.test.mjs so the cases run beside it.
import { test } from "node:test";
import { abortCase } from "./night-helpers.mjs";

test("the canary aborts when the guard did not run", () => {
  abortCase(
    "night-skip-guard",
    { STUB_CANARY_SKIP_GUARD: "1" },
    /the PreToolUse guard did NOT run/,
    1,
  );
});

test("the canary aborts when the Stop hook left no receipt", () => {
  abortCase("night-skip-stop", { STUB_CANARY_SKIP_STOP: "1" }, /the Stop hook left no receipt/, 1);
});

test("the canary aborts when the strict MCP configuration did not take", () => {
  abortCase("night-mcp", { STUB_CANARY_MCP: "1" }, /--strict-mcp-config did not take/, 1);
});
