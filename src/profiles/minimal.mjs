/**
 * The `minimal` profile: what abatty is, and the few rules no stack argues with. The default of a
 * repository `init` sets up, where `synovitec` was: six outside reviews read the eighty rules of
 * one team's standard as the price of trying the tool, and a stranger met a red gate, a harness
 * and a dozen documents before seeing a single check bite. Here the gate, CI running it, the
 * controls and the ratchet are the product; a linter, a formatter and tests, the secret scan, the
 * audit, the lockfile, no tracked `.env` and the 800-line cap are the floor every repository
 * already agrees to. A team adds `synovitec`, or its own profile, when it wants more.
 */
import { synovitec } from "./synovitec.mjs";

/** The rules this profile holds, in the order of its plan: the instrument, the basics, the proof. */
const PLAN = /** @type {[string, string[]][]} */ ([
  ["1", ["INST-GATE", "INST-RATCHET", "INST-CI", "SEC-SECRETS", "SEC-ENVFILES", "SEC-LOCKFILE"]],
  ["2", ["CODE-LINTER", "CODE-FORMAT", "TEST-UNIT", "SEC-AUDIT", "CODE-SIZE-800"]],
  ["3", ["INST-CONTROLS", "INST-CI-STEPS"]],
]);

const byId = new Map(synovitec.rules.map((r) => [r.id, r]));

/** @type {import("./index.mjs").Profile} */
export const minimal = {
  id: "minimal",
  name: "Minimal: the gate, the ratchet, the proof, and the basics every stack shares",
  description:
    "Thirteen rules a repository of any stack agrees to: one gate run by the hook and by CI, a ratchet with today's floor, controls that prove each step can fail, a linter, a formatter and tests, the secret scan, the audit, a committed lockfile, no tracked .env, and no file over 800 lines. The default of a new repository; add synovitec or your own profile for more.",
  rules: PLAN.flatMap(([phase, ids]) =>
    ids.map((id) => {
      const rule = byId.get(id);
      if (!rule) throw new Error(`minimal profile: no rule ${id}`);
      // The same rule and the same check, placed in this profile's own three-step plan.
      return { ...rule, phase };
    }),
  ),
  phases: [
    {
      id: "1",
      title: "The gate: one script, the hook and CI run it, the ratchet holds today's floor",
      size: "S",
      blocksOn: [],
      exit: "a push runs the gate locally and in CI, and the ratchet has a committed baseline",
    },
    {
      id: "2",
      title: "The basics: a linter, a formatter, tests, the audit, no file over 800 lines",
      size: "S",
      blocksOn: ["1"],
      exit: "each basic is a step of the gate",
    },
    {
      id: "3",
      title: "The proof: every gate step watched going red, CI running every step",
      size: "S",
      blocksOn: ["2"],
      exit: "abatty prove reports no step that stays green on its control",
    },
  ],
  presets: ["next", "astro", "vite-react", "node", "python", "docs"],
  harnessRules: [],
};
