import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { RULES, runCatalog } from "../src/rules/index.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { phasesFor } from "../src/profiles/index.mjs";
import { synovitec } from "../src/profiles/synovitec.mjs";
import { validateConfig } from "../src/core/config.mjs";

/** @param {import("../src/rules/index.mjs").Finding[]} f @param {string} id */
const of = (f, id) => f.find((x) => x.id === id) || assert.fail(`${id} in the findings`);

test("the stage is read from the tree: documents alone are design, sources are build, a deploy surface is run; the config names it", () => {
  const design = tempRepo("stage-design", {
    "README.md": "# A product\n",
    "docs/ADR-001.md": "# Shape\n",
  });
  const d = buildContext(design);
  assert.equal(d.stage, "design");
  assert.equal(d.stageFrom, "tree");
  const build = tempRepo("stage-build", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  assert.equal(buildContext(build).stage, "build");
  const run = tempRepo("stage-run", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
    Dockerfile: "FROM node:22\n",
  });
  assert.equal(buildContext(run).stage, "run");
  const named = tempRepo("stage-named", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
    "abatty.config.json": JSON.stringify({ stage: "design" }) + "\n",
  });
  const n = buildContext(named);
  assert.equal(n.stage, "design");
  assert.equal(n.stageFrom, "config");
  assert.match(validateConfig({ stage: "later" }).join(" "), /stage/);
});

test("a rule of another stage is n/a with the stage named: design keeps the documents, the changelog, a decisions log and a CI that can fail", () => {
  const design = tempRepo("stage-design-rules", {
    "README.md": "# A product under design\n",
    "docs/ADR-001.md": "# Shape\n",
    "schema.prisma": "model User { id Int @id }\n",
    "src/types.ts": "export type User = { id: number };\n",
    "abatty.config.json": JSON.stringify({ stage: "design" }) + "\n",
  });
  const f = runCatalog(buildContext(design), RULES);
  assert.equal(of(f, "INST-RATCHET").status, "n/a");
  assert.equal(
    of(f, "INST-RATCHET").evidence,
    "does not apply: not at this stage: design (a rule of the build and run stages)",
  );
  assert.equal(
    of(f, "CODE-LINTER").status,
    "n/a",
    "sources at design are not held to the linter yet",
  );
  assert.match(of(f, "CODE-LINTER").evidence, /not at this stage: design/);
  assert.equal(
    of(f, "DATA-BACKUP").evidence,
    "does not apply: not at this stage: design (a rule of the run stage)",
  );
  for (const id of [
    "DOC-CHANGELOG",
    "DOC-ADR",
    "INST-CI",
    "FLOW-CHANGELOG-GATE",
    "SEC-SECRETS",
    "HARNESS-HOOKS",
  ])
    assert.notEqual(of(f, id).status, "n/a", `${id} at design`);
  assert.deepEqual(of(f, "INST-RATCHET").stages, ["build", "run"]);
  assert.deepEqual(of(f, "DOC-ADR").stages, ["design", "build", "run"]);

  const run = tempRepo("stage-run-rules", {
    "package.json":
      JSON.stringify({ name: "svc", private: true, dependencies: { pg: "8.0.0" } }) + "\n",
    "src/server.js": "module.exports = 1;\n",
    "abatty.config.json": JSON.stringify({ stage: "run" }) + "\n",
  });
  const r = runCatalog(buildContext(run), RULES);
  assert.equal(of(r, "DATA-BACKUP").status, "missing", "a restore drill is a run-stage rule");
  const built = tempRepo("stage-build-rules", {
    "package.json":
      JSON.stringify({ name: "svc", private: true, dependencies: { pg: "8.0.0" } }) + "\n",
    "src/server.js": "module.exports = 1;\n",
  });
  assert.match(
    of(runCatalog(buildContext(built), RULES), "DATA-BACKUP").evidence,
    /not at this stage: build/,
  );
});

test("the plan per stage, the report and the screens carry the stage, init records it", () => {
  assert.deepEqual(
    phasesFor([synovitec], "design").map((p) => p.id),
    ["A.1"],
  );
  assert.equal(phasesFor([synovitec], "build").length, 14);
  const dir = tempRepo("stage-cli", { "package.json": NEXT_PKG });
  const init = cli(["init", dir, "--stack", "next", "--stage", "design"], dir);
  assert.equal(init.code, 0, init.out);
  assert.equal(JSON.parse(readFileSync(join(dir, "abatty.config.json"), "utf8")).stage, "design");
  const report = JSON.parse(cli(["measure", dir, "--json"], dir).out);
  assert.equal(report.stage, "design");
  assert.equal(report.stageFrom, "config");
  const md = cli(["measure", dir, "--out", "docs/GAP.md"], dir);
  assert.equal(md.code, 0, md.out);
  assert.match(
    readFileSync(join(dir, "docs/GAP.md"), "utf8"),
    /the repository at the design stage/,
  );
  const status = cli(["status", dir, "--fresh"], dir);
  assert.match(status.out, /stage\s+design/);
  const ex = cli(["explain", "data-backup", dir], dir);
  assert.match(ex.out, /applies\s+a repository with a database · at run/);
});
