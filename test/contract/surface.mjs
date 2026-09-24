// The machine surfaces an adopter builds on, read as data: the commands, the exit codes, the
// config's keys, the probes and their definitions, the rules, the shapes of the JSON report, the
// ratchet's JSON and SARIF, and the pipeline `abatty ci` writes. A change to any of them can turn
// an adopter's green run red or break a script that reads the output, which is what a minor
// release means below 1.0 (docs/VERSIONING.md). test/contract-surface.test.mjs holds them equal
// to the committed snapshot, so every such change is a decision someone makes, not an accident.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXIT } from "../../src/cli/exit.mjs";
import { BUILTIN_PROBES } from "../../src/ratchet/index.mjs";
import { RULES } from "../../src/rules/index.mjs";
import { renderGithubActions } from "../../src/ci/github.mjs";
import { presetById } from "../../src/presets/index.mjs";
import { buildReport } from "../../src/core/report.mjs";
import { cli, tempRepo } from "../helpers.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The keys of an object, sorted; nested one level for the objects among them. @param {any} o */
function shape(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return typeof o;
  return Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, Array.isArray(o[k]) ? "array" : typeof o[k]]),
  );
}

/** The schema's keys and their declared types, nested objects one level down. @param {any} props */
function schemaShape(props) {
  return Object.fromEntries(
    Object.keys(props)
      .sort()
      .map((k) => {
        const p = props[k] || {};
        const type = Array.isArray(p.type) ? p.type.join("|") : String(p.type || "any");
        return [k, p.properties ? { type, keys: Object.keys(p.properties).sort() } : type];
      }),
  );
}

/** Every surface, computed now. */
export async function surface() {
  const bin = readFileSync(`${ROOT}bin/abatty.mjs`, "utf8");
  const known = /const KNOWN = \[([\s\S]*?)\];/.exec(bin)?.[1] || "";
  const commands = [...known.matchAll(/"([^"]+)"/g)].map((m) => String(m[1])).sort();
  const schema = JSON.parse(readFileSync(`${ROOT}schema/abatty.config.schema.json`, "utf8"));

  const dir = tempRepo("contract", {
    "package.json": JSON.stringify({ name: "c", scripts: { test: "node -e 0" } }),
    "src/a.ts": "export const a = 1;\n",
  });
  const report = await buildReport(dir, { write: false, cache: false });
  const ratchet = JSON.parse(cli(["ratchet", dir, "--json"], dir).out);
  const sarif = JSON.parse(cli(["ratchet", dir, "--sarif"], dir).out);
  const next = presetById("next");
  const ci = next ? renderGithubActions(next, { base: "main" }) : "";

  return {
    commands,
    exitCodes: { ...EXIT },
    config: schemaShape(schema.properties),
    probes: Object.fromEntries(
      BUILTIN_PROBES.map((p) => [
        p.metric,
        `${p.kind}${p.optIn ? " opt-in" : ""}${p.probation ? " probation" : ""} v${p.version ?? 1}`,
      ]).sort(([a], [b]) => String(a).localeCompare(String(b))),
    ),
    rules: Object.fromEntries(
      RULES.map((r) => [r.id, `${r.level} ${r.enforcement}`]).sort(([a], [b]) =>
        String(a).localeCompare(String(b)),
      ),
    ),
    report: shape(report),
    ratchetJson: { top: shape(ratchet), verdict: shape(ratchet.verdicts?.[0]) },
    sarif: {
      top: shape(sarif),
      run: shape(sarif.runs?.[0]),
      driver: shape(sarif.runs?.[0]?.tool?.driver),
    },
    generatedPipeline: {
      steps: [...ci.matchAll(/^\s+- name: (.+)$/gm)].map((m) => String(m[1])),
      uses: [...ci.matchAll(/uses: (\S+)/g)].map((m) => String(m[1])),
    },
  };
}
