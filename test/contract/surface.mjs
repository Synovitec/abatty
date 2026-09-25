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

/**
 * The shape of a value, three levels deep: an object's keys sorted with the shape of each, an
 * array as the shape of its first element (or "array" when empty), anything else its type. A
 * renamed nested field changes it; a value does not.
 * @param {unknown} o @param {number} [depth] @returns {unknown}
 */
function shape(o, depth = 3) {
  if (Array.isArray(o)) return o.length && depth > 0 ? [shape(o[0], depth - 1)] : "array";
  if (!o || typeof o !== "object") return o === null ? "null" : typeof o;
  if (depth <= 0) return "object";
  const obj = /** @type {Record<string, unknown>} */ (o);
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((k) => [k, shape(obj[k], depth - 1)]),
  );
}

/** The schema's keys and their declared types, nested objects one level down. @param {Record<string, { type?: string | string[], properties?: object }>} props */
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

/** A preset's generated pipeline: its step names and the actions it pins. @param {string} id */
function pipeline(id) {
  const preset = presetById(id);
  const ci = preset ? renderGithubActions(preset, { base: "main" }) : "";
  return {
    steps: [...ci.matchAll(/^\s+- name: (.+)$/gm)].map((m) => String(m[1])),
    uses: [...ci.matchAll(/uses: (\S+)/g)].map((m) => String(m[1])),
  };
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
    ratchetJson: shape(ratchet),
    sarif: shape(sarif, 5),
    generatedPipeline: { next: pipeline("next"), node: pipeline("node") },
  };
}
