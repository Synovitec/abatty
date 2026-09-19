/**
 * The `profiles` command: the profiles this repository follows, what each brings, and the
 * problems loading them.
 */
import { controlOf, loadCatalog, ruleById, runCatalog } from "../rules/index.mjs";
import { buildContext } from "../rules/context.mjs";
import { renderCatalogMarkdown } from "../ui/catalog.mjs";
import { stdIds } from "../core/gap-analysis.mjs";
import { EXIT } from "./exit.mjs";
import { readAdoption } from "../core/repo.mjs";
import { loadProfiles, profileNames } from "../profiles/index.mjs";
import * as t from "../ui/term.mjs";

/** @param {import("./ratchet.mjs").CliContext} c */
export async function profilesCommand(c) {
  const { dir, flag, out, err, VERSION } = c;
  const config = readAdoption(dir);
  const { profiles, problems } = await loadProfiles(dir, config);
  if (flag("--json")) {
    out(
      JSON.stringify(
        {
          named: profileNames(config),
          profiles: profiles.map((p) => ({
            id: p.id,
            name: p.name,
            source: p.source,
            rules: p.rules.length,
            phases: p.phases.length,
            presets: p.presets || [],
          })),
          problems,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("profiles")} ${t.gray(`· ${profileNames(config).join(", ")}${config?.profiles === undefined ? " (the default; name them in the config → profiles)" : ""}`)}\n\n`,
  );
  for (const p of profiles) {
    out(
      `  ${t.glyph.ok} ${t.bold(p.id.padEnd(14))} ${p.name} ${t.gray(`· ${p.rules.length} rule(s), ${p.phases.length} phase(s)${p.presets?.length ? ", presets " + p.presets.join(" ") : ""} · ${p.source === "abatty" ? "built in" : p.source}`)}\n`,
    );
    if (p.description) out(`    ${t.gray(p.description)}\n`);
  }
  for (const p of problems) err(`  ${t.glyph.fail} ${p}\n`);
  out(
    `\n  ${t.gray("a profile is rules, phases, presets and harness rule files as one package: a built-in id, a file (./profiles/acme.mjs) or an installed package exporting `profile`")}\n\n`,
  );
}

/**
 * `abatty rules`: the catalog on screen, filtered, as JSON for a script or as the markdown the
 * repository commits.
 * @param {import("./ratchet.mjs").CliContext} cx
 */
export async function rulesCommand(cx) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  // The catalog as this repository sees it: the built-in rules, its own rules file, its
  // waivers. Outside a repository the built-in catalog alone.
  const catalog = await loadCatalog(dir);
  for (const p of catalog.problems) err(`${t.glyph.warn} ${p}\n`);
  const family = opt("--family").toLowerCase();
  const level = opt("--level").toLowerCase();
  // --enforcement hard|ratchet|review|prose: what insures the rule once present; review and
  // prose are the rules a night moves up a level.
  const enforcement = opt("--enforcement").toLowerCase();
  // --phase N: the rules the plan's phase N installs; a rule's phase may name several ("7 / 8").
  const phase = opt("--phase");
  const list = catalog.rules.filter(
    (r) =>
      (!family || r.family.toLowerCase() === family) &&
      (!level || r.level === level) &&
      (!enforcement || r.enforcement === enforcement) &&
      (!phase || r.phase.split(/\s*\/\s*/).includes(phase)),
  );
  if (flag("--json")) {
    // Every rule says which kind of control it is, so the balance of feedforward and feedback is
    // readable rather than accidental.
    out(
      JSON.stringify(
        list.map(({ check, ...r }) => ({ ...r, ...controlOf(/** @type {any} */ (r)) })),
        null,
        2,
      ) + "\n",
    );
    return;
  }
  if (flag("--md")) {
    out(renderCatalogMarkdown(list));
    return;
  }
  out(
    `\n${t.banner(VERSION)}  ${t.bold("rules")} ${t.gray(`· ${list.length} of ${catalog.rules.length} · profiles ${catalog.profiles.join(", ")}${catalog.localFile ? " · " + catalog.localFile : ""}`)}\n\n`,
  );
  for (const fam of [...new Set(list.map((r) => r.family))]) {
    out(t.heading(fam));
    for (const r of list.filter((x) => x.family === fam))
      out(
        `  ${r.waived ? t.glyph.skip : r.level === "must" ? t.glyph.ok : t.glyph.warn} ${t.bold(r.id.padEnd(22))} ${t.gray(r.level.padEnd(7))} ${t.gray(r.enforcement.padEnd(8))} ${t.gray(("phase " + r.phase).padEnd(12))} ${r.waived ? t.gray(r.title + " · waived") : stdIds(r.title)}${r.source && r.source !== "abatty" ? t.gray(" · " + r.source) : ""}\n`,
      );
  }
  const counts = ["hard", "ratchet", "review", "prose"].map(
    (e) => `${list.filter((r) => r.enforcement === e).length} ${e}`,
  );
  out(
    `\n  ${t.gray(`${list.filter((r) => r.level === "must").length} must · ${list.filter((r) => r.level === "should").length} should · insured by: ${counts.join(", ")} · abatty explain <ID>`)}\n\n`,
  );
  return;
}

/**
 * `abatty explain <ID>`: one rule, its reason, what insures it, and its finding in this
 * repository, which is the screen a reader meets after the gate refuses their push.
 * @param {import("./ratchet.mjs").CliContext} cx @param {string} id
 */
export async function explainCommand(cx, id) {
  const { dir, opt, flag, out, err, VERSION } = cx;
  const catalog = await loadCatalog(dir);
  const rule = id ? ruleById(id, catalog.rules) : null;
  if (!rule) {
    err(
      `${t.glyph.fail} ${id ? `no rule ${id}` : "abatty explain <ID>"}; abatty rules lists the catalog\n`,
    );
    process.exit(2);
  }
  const finding = runCatalog(buildContext(dir), [rule])[0];
  out(`\n${t.banner(VERSION)}  ${t.bold(rule.id)} ${t.gray("·")} ${stdIds(rule.title)}\n\n`);
  out(t.kv("family", rule.family) + "\n");
  out(t.kv("level", rule.level === "must" ? t.bold("must") : "should") + "\n");
  out(
    t.kv(
      "insured by",
      `${rule.enforcement}${t.gray(rule.enforcement === "hard" ? " · a machine refuses the work" : rule.enforcement === "ratchet" ? " · a number that may only fall" : rule.enforcement === "review" ? " · the reviewer's checklist" : " · written, checked by nothing yet")}`,
    ) + "\n",
  );
  if (rule.standard?.length) out(t.kv("standard", stdIds(rule.standard.join(", "))) + "\n");
  out(t.kv("phase", rule.phase) + "\n");
  out(
    t.kv(
      "applies",
      `${rule.when || "always"}${rule.stages ? " · at " + rule.stages.join(", ") : ""}`,
    ) + "\n",
  );
  if (rule.source && rule.source !== "abatty") out(t.kv("source", rule.source) + "\n");
  out(t.heading("Why"));
  out(`  ${rule.why}\n`);
  out(t.heading("Here", finding ? `${dir}` : ""));
  if (finding) {
    out(t.kv("status", t.status(finding.status)) + "\n");
    out(t.kv("evidence", stdIds(finding.evidence)) + "\n");
    if (finding.status === "missing" || finding.status === "partial")
      out(t.kv("next", stdIds(finding.next)) + "\n");
  }
  out("\n");
  return;
}

/**
 * `abatty check <ID>`: one rule, and an exit code that says whether it holds. This is the
 * command a finding's `verify` field names, so an agent can prove its own edit worked without a
 * human reading a screen, and it cannot drift from the rule because it runs the rule.
 * @param {import("./ratchet.mjs").CliContext} cx @param {string} id
 */
export async function checkCommand(cx, id) {
  const { dir, flag, out, err } = cx;
  const catalog = await loadCatalog(dir);
  const rule = ruleById(String(id || "").toUpperCase(), catalog.rules);
  if (!rule) {
    err(`no rule ${id || "(none named)"}; abatty rules lists the catalog\n`);
    process.exit(EXIT.input);
  }
  const finding = runCatalog(buildContext(dir), [rule])[0];
  if (!finding) {
    err(`${rule.id} produced no finding\n`);
    process.exit(EXIT.error);
  }
  const held =
    finding.status === "present" || finding.status === "n/a" || finding.status === "waived";
  if (flag("--json")) out(JSON.stringify({ ...finding, held }, null, 2) + "\n");
  else out(`${finding.id} ${finding.status} · ${finding.evidence}\n`);
  process.exit(held ? EXIT.clean : EXIT.findings);
}
