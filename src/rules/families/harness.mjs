/**
 * The agent harness: the hooks and their wiring, the adoption config, the skill and the
 * reviewer, the ignored night folder. Standard §2.5 and the autonomous adoption contract.
 */

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "HARNESS-HOOKS",
    family: "Harness",
    title:
      "Guard, protect, stop-gate, check-direction, session-brief, self-test hooks present and wired",
    standard: ["FLOW-2", "FLOW-3", "DATA-1"],
    level: "must",
    enforcement: "hard",
    phase: "A.1 / 0",
    why: "Context is not enforcement: the guard denies the dangerous command before it runs, the stop gate refuses 'done' while the gate is red, protect keeps the harness read-only to the worker, and the direction check refuses a loosened floor. Prose in the context file does none of that.",
    next: "Copy the hooks and settings.project.json (abatty init); run the self-test",
    check: (c) => {
      const settings = c.readJson(`${c.agentRoot}/settings.json`);
      /** @type {Record<string, { hooks?: unknown[] }[]>} */
      const hooks = settings?.hooks || {};
      /** @param {string} ev @param {string} name */
      const wired = (ev, name) =>
        (hooks[ev] || []).some((m) =>
          (m.hooks || []).some((h) => JSON.stringify(h).includes(name)),
        );
      const have = [
        "guard.mjs",
        "stop-gate.mjs",
        "session-brief.mjs",
        "self-test.mjs",
        "lib.mjs",
      ].filter((f) => c.exists(`${c.agentRoot}/hooks/${f}`));
      const any = c.files(/^\.claude\/hooks\/.+/).map((f) => f.replace(/^\.claude\/hooks\//, ""));
      const core = have.length >= 4 && wired("PreToolUse", "guard") && wired("Stop", "stop-gate");
      // The tamper controls: the harness read-only to the worker (protect.mjs on Edit|Write) and
      // nothing loosened against the base (check-direction.mjs). A harness without them is the one
      // the worker could rewrite, and reads partial with the two names.
      const tamper = ["protect.mjs", "check-direction.mjs"].filter(
        (f) => !c.exists(`${c.agentRoot}/hooks/${f}`),
      );
      if (!tamper.length && !wired("PreToolUse", "protect"))
        tamper.push("protect.mjs not wired on Edit|Write");
      return {
        status:
          core && !tamper.length
            ? "present"
            : have.length > 0 || Object.keys(hooks).length > 0
              ? "partial"
              : "missing",
        evidence: `hooks: ${any.join(", ") || "none"}; wired: ${["PreToolUse", "Stop", "SessionStart"].filter((e) => (hooks[e] || []).length).join(", ") || "none"}${core && tamper.length ? "; missing the tamper controls: " + tamper.join(", ") : ""}`,
        next:
          core && tamper.length
            ? "Copy protect.mjs, check-direction.mjs, the new stop-gate.mjs, lib.mjs and settings.project.json (abatty init --force); run the self-test"
            : "Copy the hooks and settings.project.json (abatty init); run the self-test",
      };
    },
  },
  {
    id: "HARNESS-ADOPTION",
    family: "Harness",
    title:
      "abatty.config.json (or .claude/adoption.json) names the gate, files, push policy and phases",
    level: "must",
    enforcement: "hard",
    phase: "A.1",
    why: "The hooks read one config for the gate command, the protected paths, the base branch and the phases; without it every hook guesses.",
    next: "abatty init writes abatty.config.json at the root; edit the commands there",
    check: (c) => {
      const root = c.exists("abatty.config.json");
      const legacy = c.exists(`${c.agentRoot}/adoption.json`);
      return {
        status: root || legacy ? "present" : "missing",
        evidence: root
          ? "abatty.config.json" +
            (legacy ? " (and the older .claude/adoption.json: abatty config --migrate)" : "")
          : legacy
            ? ".claude/adoption.json (abatty config --migrate moves it to the root)"
            : "none",
      };
    },
  },
  {
    id: "HARNESS-SKILL",
    family: "Harness",
    title: "adopt-standards skill and standards-reviewer agent",
    level: "must",
    enforcement: "review",
    phase: "A.1",
    why: "The skill is the protocol of a night (measure, pick the phase, ten files, gate, review, commit); the reviewer is the second reader with the thirteen-item checklist before every phase commit.",
    next: "Copy the skill and the two agents (abatty init)",
    check: (c) => {
      const skill =
        c.exists(`${c.agentRoot}/skills/adopt-standards/SKILL.md`) ||
        c.exists(".agents/skills/adopt-standards/SKILL.md") ||
        c.exists(".cursor/skills/adopt-standards/SKILL.md");
      const reviewer = c.exists(`${c.agentRoot}/agents/standards-reviewer.md`);
      return {
        status: skill && reviewer ? "present" : skill || reviewer ? "partial" : "missing",
        evidence: `${skill ? "skill" : "no skill"}, ${reviewer ? "reviewer" : "no reviewer"}`,
      };
    },
  },
  {
    id: "HARNESS-GITIGNORE",
    family: "Harness",
    title: ".claude/night/ ignored",
    level: "must",
    enforcement: "hard",
    phase: "A.1",
    why: "The night's run state and receipts are machine-local; committed, they would be a trace and a merge conflict.",
    next: "Add .claude/night/ to .gitignore",
    check: (c) => {
      const gi = c.read(".gitignore");
      const ignored = /\.claude\/night/.test(gi);
      return {
        status: ignored ? "present" : c.exists(`${c.agentRoot}/adoption.json`) ? "missing" : "n/a",
        evidence: ignored ? "ignored" : "not in .gitignore",
      };
    },
  },
];
