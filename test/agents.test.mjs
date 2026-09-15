import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, STUB_AGENT, cli, git, tempRepo } from "./helpers.mjs";
import {
  ADAPTERS,
  AGENTS_MD,
  CURSOR,
  PRIMARY,
  adapterById,
  configuredAdapters,
  lostGuarantees,
  sessionArgs,
  toMdc,
} from "../src/agents/index.mjs";
import { runNight } from "../src/night/runner.mjs";

test("the registry: the primary's id comes from its folder, the others are open conventions, and what each loses is said", () => {
  assert.equal(PRIMARY.id, PRIMARY.folder?.replace(/^\./, ""));
  assert.deepEqual(
    ADAPTERS.map((a) => a.id),
    [PRIMARY.id, "agents-md", "cursor"],
  );
  assert.equal(adapterById("nope"), null);
  assert.deepEqual(lostGuarantees(PRIMARY), []);
  assert.match(
    lostGuarantees(AGENTS_MD).join("; "),
    /the guard.*the Stop gate.*the unattended night.*path-scoped rules/,
  );
  assert.match(lostGuarantees(CURSOR).join("; "), /the unattended night/);
  assert.doesNotMatch(lostGuarantees(CURSOR).join("; "), /path-scoped rules/, "Cursor has rules");
  assert.deepEqual(
    configuredAdapters(null).adapters.map((a) => a.id),
    [PRIMARY.id],
    "the primary when none is named",
  );
  const c = configuredAdapters({ agents: ["cursor", "ghost"] });
  assert.deepEqual(
    c.adapters.map((a) => a.id),
    ["cursor"],
  );
  assert.deepEqual(c.unknown, ["ghost"]);
});

test("the headless flags of the primary are the ones the runner has always used; an adapter without a headless mode refuses", () => {
  const args = sessionArgs(PRIMARY, {
    prompt: "/adopt-standards --phase 1",
    mode: "auto",
    budget: 5,
    model: "opus",
    effort: "high",
    mcpConfig: "/x/mcp.json",
    name: "adopt-1",
  });
  assert.deepEqual(args, [
    "-p",
    "/adopt-standards --phase 1",
    "--permission-mode",
    "auto",
    "--permission-prompts",
    "none",
    "--output-format",
    "json",
    "--max-budget-usd",
    "5",
    "--model",
    "opus",
    "--effort",
    "high",
    "--strict-mcp-config",
    "--mcp-config",
    "/x/mcp.json",
    "-n",
    "adopt-1",
  ]);
  assert.throws(
    () =>
      sessionArgs(CURSOR, {
        prompt: "x",
        mode: "auto",
        budget: 1,
        model: "m",
        effort: "e",
        mcpConfig: "c",
        name: "n",
      }),
    /no headless mode/,
  );
});

test("a path-scoped rule becomes a Cursor .mdc rule: the paths as globs, never always-on, the body kept", () => {
  const mdc = toMdc(
    '---\npaths:\n  - "**/*.tsx"\n  - "**/theme/**"\n---\n\n# Accessibility rules (loaded when markup is open)\n\nTarget: WCAG 2.2 AA.\n',
  );
  assert.match(
    mdc,
    /^---\ndescription: "Accessibility rules"\nglobs: "\*\*\/\*\.tsx,\*\*\/theme\/\*\*"\nalwaysApply: false\n---\n# Accessibility rules/,
  );
  assert.match(mdc, /Target: WCAG 2\.2 AA\./);
});

test("init --agent writes AGENTS.md for the open convention, the primary importing it, and the preset's rules as .mdc for Cursor", () => {
  const dir = tempRepo("agents-init", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next", "--agent", "cursor,agents-md," + PRIMARY.id], dir);
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(join(dir, "AGENTS.md")));
  assert.equal(
    readFileSync(join(dir, PRIMARY.contextFile), "utf8"),
    "@AGENTS.md\n",
    "one source, imported",
  );
  assert.ok(existsSync(join(dir, ".cursor/rules/a11y.mdc")));
  assert.match(
    readFileSync(join(dir, ".cursor/rules/a11y.mdc"), "utf8"),
    /^---\ndescription: .*\nglobs: /,
  );
  assert.ok(existsSync(join(dir, ".claude/rules/a11y.md")), "the primary's rules stay");
  // the catalog reads the context through AGENTS.md when the primary's file only imports it
  const measure = cli(["measure", dir, "--quiet"], dir);
  assert.equal(measure.code, 0, measure.out);
  const agents = cli(["agents", dir], dir);
  assert.equal(agents.code, 0, agents.out);
  assert.match(agents.out, /cursor\s+Cursor/);
  assert.match(agents.out, /without: .*the unattended night/);
});

test("a repository whose adapters have no hook protocol gets no night, and the reason names what is lost", () => {
  const dir = tempRepo("agents-no-night", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.agents = ["agents-md"];
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: the instrument");
  /** @type {string[]} */
  const lines = [];
  const r = runNight({
    repoDir: dir,
    until: "+5min",
    maxCostUsd: 5,
    noPush: true,
    agent: STUB_AGENT,
    log: (l) => lines.push(l),
  });
  assert.equal(r.ok, false);
  assert.match(
    lines.join("\n"),
    /no night for agents-md: an adapter without a hook protocol loses the guard/,
  );
  const agents = cli(["agents", dir], dir);
  assert.match(agents.out, /no adapter with hooks: no night/);
});
