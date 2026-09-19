/**
 * Agent security: what holds when the person is asleep. Standard SEC.5.
 *
 * The other families ask what the code does. These ask what the agent may do to the repository
 * and what the repository may do to the agent, which is a different question and the one the
 * industry's own incidents are about: an unattended run is a session with no reviewer, and the
 * two directions of trust are both open by default.
 *
 * Every rule here is a harnessed repository's. A repository nobody points a model at overnight is
 * not failing them; it is not running them, and the finding says so.
 */
import { HARNESSED } from "../applies.mjs";

/** The settings file an agent's permission surface lives in. @param {import("../context.mjs").RepoContext} c */
const settings = (c) => (c.exists(".claude/settings.json") ? c.read(".claude/settings.json") : "");

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "SEC-AGENT-SANDBOX",
    family: "Agent security",
    title: "An unattended run is sandboxed, and the sandbox proves its own boundary",
    standard: ["SEC.5"],
    level: "must",
    enforcement: "review",
    phase: "0",
    ...HARNESSED,
    why: "A sandbox nobody has watched hold is a claim, not a boundary. The cost of finding out it was decorative is a repository edited by something that was never supposed to reach it, at three in the morning, with nobody watching.",
    next: "Run the night under a sandbox whose probe writes to a path it must not reach, and refuse the night when the boundary is present but does not hold",
    check: (c) => {
      const cfg = /** @type {any} */ (c.adoption) || {};
      const mode = String(cfg.sandbox?.mode || cfg.sandbox || "");
      if (!mode)
        return { status: "missing", evidence: "the config does not name a sandbox (sandbox.mode)" };
      if (mode === "off")
        return { status: "partial", evidence: "sandbox: off, stated rather than assumed" };
      return { status: "present", evidence: `sandbox: ${mode}` };
    },
  },
  {
    id: "SEC-AGENT-PERMISSIONS",
    family: "Agent security",
    title: "The permission surface is written down, and the dangerous commands are denied",
    standard: ["SEC.5"],
    level: "must",
    enforcement: "hard",
    phase: "0",
    ...HARNESSED,
    why: "A permission surface that is not written down is whatever the tool defaulted to on the day it was installed, and nobody on the team can tell you what it is. The deny list is the one place a reviewer can read what the agent may never do.",
    next: "Declare the permission surface in the agent's settings, with the force push, the history rewrite and the hook bypass denied",
    check: (c) => {
      const text = settings(c);
      if (!text) return { status: "missing", evidence: "no .claude/settings.json" };
      const denied = ["--no-verify", "push --force", "reset --hard", "filter-branch"].filter((d) =>
        text.includes(d),
      );
      return {
        status: denied.length >= 3 ? "present" : denied.length ? "partial" : "missing",
        evidence: denied.length ? `denied: ${denied.join(", ")}` : "nothing dangerous is denied",
      };
    },
  },
  {
    id: "SEC-AGENT-TRUST",
    family: "Agent security",
    title: "The repository's own text is read before a model is pointed at it",
    standard: ["SEC.5"],
    level: "must",
    enforcement: "review",
    phase: "0",
    ...HARNESSED,
    why: "Text in a file an agent reads is an instruction in exactly the way a prompt is, and a repository is a place other people can write. The sandbox answers what the agent may do; nothing answers what the repository is telling it to do.",
    next: "Run the night's pre-flight, which refuses to start when the tree carries instruction-shaped text, a command a document asks somebody to run, or a manifest that runs code at install time",
    check: (c) => {
      const cfg = /** @type {any} */ (c.adoption) || {};
      const off = cfg.preflight?.trust === false;
      if (off)
        return { status: "partial", evidence: "the trust scan is switched off in the config" };
      return {
        status: c.exists(".claude/hooks") || Boolean(c.adoption) ? "present" : "missing",
        evidence: c.adoption ? "the night's pre-flight scans the tree" : "no night configured",
      };
    },
  },
  {
    id: "SEC-AGENT-MCP",
    family: "Agent security",
    title: "The servers a night may reach are named, and only those",
    standard: ["SEC.5"],
    level: "must",
    enforcement: "review",
    phase: "0",
    ...HARNESSED,
    why: "A server the configuration does not name is a surface nobody reviewed, reachable by something running with no human in the loop. The canary judges the declared set; an undeclared one is the case it cannot judge.",
    next: "Name the MCP servers the night may use in the config, and let the canary refuse an undeclared one",
    check: (c) => {
      const cfg = /** @type {any} */ (c.adoption) || {};
      const named = cfg.mcp?.servers || cfg.mcpServers;
      const count = Array.isArray(named) ? named.length : named ? Object.keys(named).length : 0;
      if (!c.exists(".claude/night") && !cfg.phases)
        return { status: "n/a", evidence: "no night configured" };
      return {
        status: count ? "present" : "partial",
        evidence: count ? `${count} server(s) named` : "no server named: the night runs with none",
      };
    },
  },
  {
    id: "SEC-AGENT-SHIM",
    family: "Agent security",
    title: "The bypass is refused outside the agent as well as inside it",
    standard: ["SEC.5"],
    level: "should",
    enforcement: "review",
    phase: "0",
    ...HARNESSED,
    why: "A guard that lives in one tool's hook is a property of that tool, not of the repository: the same force push goes through from a second terminal, a script or another assistant. The layer that makes it a property of the repository is a `git` the shell finds first.",
    next: "Install the shim (`abatty init` writes .claude/bin/) and put that directory on PATH for any run that is not being watched",
    check: (c) => {
      const wrapper = c.exists(".claude/bin/git") || c.exists(".claude/bin/git.cmd");
      const logic = c.exists(".claude/bin/shim.mjs");
      if (wrapper && logic) return { status: "present", evidence: "the git shim is installed" };
      if (wrapper || logic)
        return {
          status: "partial",
          evidence: wrapper
            ? "a wrapper with no refusals beside it"
            : "the refusals with no wrapper",
        };
      return { status: "missing", evidence: "no shim: a bypass outside the agent meets nothing" };
    },
  },
  {
    id: "SEC-AGENT-BYPASS",
    family: "Agent security",
    title: "A commit made with a bypass is visible, not invisible",
    standard: ["SEC.5"],
    level: "should",
    enforcement: "review",
    phase: "0",
    ...HARNESSED,
    why: "The guard refuses a bypass at the moment it is attempted, which leaves the one that happened outside the guard: a commit made where the hook was not installed. A bypass that nobody can see afterwards is a gate with a hole nobody can measure.",
    next: "Have CI report commits whose hook did not run, and accept the ones that carry a documented reason",
    check: (c) => {
      const ci = c.ciText || "";
      const seen = /bypass|--no-verify|verify-commit|hook did not run/i.test(ci);
      return {
        status: seen ? "present" : "missing",
        evidence: seen ? "CI looks for a bypassed commit" : "nothing reports a bypassed commit",
      };
    },
  },
];
