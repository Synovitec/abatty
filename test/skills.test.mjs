import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { TEMPLATES } from "../src/core/init.mjs";
import { PRIMARY } from "../src/agents/index.mjs";
import { frontMatter } from "../src/ratchet/probes/lib.mjs";
import { REQUIRED_PATHS } from "../src/core/vocabulary.mjs";

const SKILL = readFileSync(join(TEMPLATES, "skills/adopt-standards/SKILL.md"), "utf8");

test("the skill is in the open agent-skills format: name, description, license, compatibility, metadata; the body under the format's cap", () => {
  const fm = frontMatter(SKILL);
  assert.ok(fm);
  assert.match(String(fm.name), /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(String(fm.name).length <= 64);
  assert.ok(String(fm.description).length > 0 && String(fm.description).length <= 1024);
  assert.equal(fm.license, "Apache-2.0");
  assert.ok(String(fm.compatibility).length > 0);
  assert.ok(SKILL.split("\n").length <= 500, "an open-format skill stays under 500 lines");
  // agent-neutral: the protocol names the config, the context file and the skills of any agent, never one vendor's
  assert.doesNotMatch(SKILL, /mattpocock/);
  assert.match(SKILL, /abatty\.config\.json/);
  // the context file's name comes from the vocabulary's required paths, so this file names no tool
  assert.ok(SKILL.includes("`" + REQUIRED_PATHS[3] + "`, or `AGENTS.md`"));
});

test("init writes the skill to every configured adapter's skills folder, identical", () => {
  const dir = tempRepo("skills-init", { "package.json": NEXT_PKG });
  const r = cli(["init", dir, "--stack", "next", "--agent", `${PRIMARY.id},agents-md,cursor`], dir);
  assert.equal(r.code, 0, r.out);
  for (const p of [
    ".claude/skills/adopt-standards/SKILL.md",
    ".agents/skills/adopt-standards/SKILL.md",
    ".cursor/skills/adopt-standards/SKILL.md",
  ]) {
    assert.ok(existsSync(join(dir, p)), p);
    assert.equal(readFileSync(join(dir, p), "utf8"), SKILL, `${p} is the template`);
  }
  const only = tempRepo("skills-primary", { "package.json": NEXT_PKG });
  cli(["init", only, "--stack", "next"], only);
  assert.ok(existsSync(join(only, ".claude/skills/adopt-standards/SKILL.md")));
  assert.equal(
    existsSync(join(only, ".agents/skills/adopt-standards/SKILL.md")),
    false,
    "only the configured adapters",
  );
});
