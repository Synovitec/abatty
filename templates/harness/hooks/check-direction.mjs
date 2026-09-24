// Direction check: what the worker may not loosen at night, judged against the base branch.
//
// A gate that is green because a floor was raised, a threshold lowered, a rule switched off, a
// path added to `ignores`, `--max-warnings=0` dropped or a hook deleted is the one way an
// unattended run can "succeed" while lying. The Stop gate runs this after the gate and blocks on
// it; the runner runs it before the push and keeps the branch local on red. FLOW.3 in the
// standard ("never lower a gate to go green") moves from Review to Hard for the night with it.
//
// Two classes of finding. HARD ones block regardless: the harness (.claude/) differs from the
// base, a baseline number rose or a metric vanished, the import graph's known violations grew,
// knip's --max-issues rose or --no-exit-code appeared, `--max-warnings=0` left a lint script, the
// gate, the pre-push hook or the baseline was deleted, `thresholds.autoUpdate` appeared. The
// others (a rule to off, an ignore added, a coverage floor lowered, a strict flag off, a CI file
// removed) are what FLOW.3 allows "with a written reason": they block unless the decisions file
// names the rule, path, flag or file - the reason is then mechanically required, and the morning
// sees it. The plan's own example is `no-await-in-loop` switched off per directory in phase 1.
//
//   node .claude/hooks/check-direction.mjs [--base <ref>] [--json]      exit 2 on a blocking finding
//
// Text comparison, no parser: ESLint and Vitest configs are code, and the rule of thumb (count
// of blocks at on/off per rule, numbers per threshold key in order) is what changes between a
// base and a tampered tree. A config restructured beyond what it can read is reported as such.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HARNESS_DIR, ROOT_CONFIG, loadConfig, parseJsonText } from "./lib.mjs";

const STRICT_FLAGS = ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes", "noImplicitAny", "strictNullChecks", "checkJs", "noImplicitOverride"];
const GUARDED_SCRIPTS = ["gate", "gate:fast", "standards", "lint", "typecheck", "test"];
const CI_FILE = /^\.woodpecker(\/.*\.ya?ml|\.ya?ml)$/;
const INSTRUMENT_FILE = /^(\.githooks\/|\.husky\/|lefthook\.ya?ml$|scripts\/ci\/|scripts\/hooks\/)/;

/**
 * Compare the working tree with `base` and return { ok, base, blocking, recorded, error }.
 * `recorded` holds the loosenings a decision names; `blocking` everything else. `ok: false`
 * with `error` when the base ref cannot be read - the caller decides what that means.
 */
export function checkDirection({ base, config = loadConfig(), cwd = process.cwd() } = {}) {
  const g = (...a) => {
    try {
      return { ok: true, out: execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }) };
    } catch {
      return { ok: false, out: "" };
    }
  };
  base = base || config.baseBranch || "main";
  if (!g("rev-parse", "--verify", "--quiet", `${base}^{commit}`).ok) {
    return { ok: false, base, error: `base ref "${base}" not found`, blocking: [], recorded: [] };
  }
  const atBase = (p) => {
    const r = g("show", `${base}:${p}`);
    return r.ok ? r.out : null;
  };
  const inTree = (p) => (existsSync(join(cwd, p)) ? readFileSync(join(cwd, p), "utf8") : null);
  const baseFiles = g("ls-tree", "-r", "--name-only", base).out.split(/\r?\n/).filter(Boolean);
  const findings = [];
  const add = (f) => findings.push(f);

  // A. The harness. Tracked files under .claude/ that differ from the base: modified, deleted or
  // added to the index. The hooks that judge the run are not the run's to edit.
  const harness = g("diff", "--name-only", base, "--", HARNESS_DIR).out.split(/\r?\n/).filter(Boolean);
  if (harness.length) {
    add({ kind: "harness", file: harness.join(", "), hard: true, detail: `${harness.length} file(s) under ${HARNESS_DIR} differ from ${base}`, fix: `git checkout ${base} -- ${HARNESS_DIR} && git commit -m "chore(standards): restore the harness"` });
  }
  // The root config, named as itself. At night it is read-only whatever the change. By day only a
  // loosening is one: an adopter who enabled a probe was told a tightening was a loosening "under
  // .claude/", with a command to restore the looser file.
  if (g("diff", "--name-only", base, "--", ROOT_CONFIG).out.trim()) {
    const loosened = configLoosenings(atBase(ROOT_CONFIG), inTree(ROOT_CONFIG));
    if (process.env.ADOPTION_RUN === "1" || loosened.length)
      add({
        kind: "harness",
        file: ROOT_CONFIG,
        hard: true,
        detail: process.env.ADOPTION_RUN === "1" ? `${ROOT_CONFIG} differs from ${base}; it is read-only to an unattended run` : `${ROOT_CONFIG} changed against ${base} beyond a tightening: ${loosened.join(", ")}`,
        fix: `git checkout ${base} -- ${ROOT_CONFIG}, or record the change in the decisions file`,
      });
  }

  // B. The baseline: no number under metrics or debt rises, no metric disappears.
  const baselinePath = [config.files?.baseline, "scripts/ci/standards-baseline.json", "docs/standards-baseline.json"].filter(Boolean).find((p) => baseFiles.includes(p));
  if (baselinePath) {
    const bText = atBase(baselinePath);
    const tText = inTree(baselinePath);
    if (tText === null) {
      add({ kind: "baseline", file: baselinePath, hard: true, detail: "the baseline was deleted", fix: `git checkout ${base} -- ${baselinePath}` });
    } else {
      try {
        const b = numericLeaves(pick(parseJsonText(bText), ["metrics", "debt"]));
        const t = numericLeaves(pick(parseJsonText(tText), ["metrics", "debt"]));
        for (const [key, bv] of b) {
          const tv = t.get(key);
          if (tv === undefined && key.startsWith("metrics.")) add({ kind: "baseline", file: baselinePath, key, hard: true, detail: `${key} (${bv}) is gone from the baseline`, fix: "A metric is never removed at night; restore it." });
          else if (tv !== undefined && tv > bv) add({ kind: "baseline", file: baselinePath, key, hard: true, detail: `${key} rose ${bv} → ${tv}`, fix: "A floor never rises at night. Undo the step that needed it (decision: seam-unclear or behaviour-risk) and split differently." });
        }
      } catch (e) {
        add({ kind: "baseline", file: baselinePath, hard: true, detail: `the baseline is not valid JSON: ${e.message}`, fix: "Restore a valid baseline." });
      }
    }
  }

  // B2. The import graph's known violations (dependency-cruiser --baseline): the file is the
  // tool's own debt list and may only shrink. Grown or deleted is a loosening like a baseline
  // number that rose (CODE.5).
  for (const file of baseFiles.filter((f) => /(^|\/)\.dependency-cruiser-known-violations\.json$/.test(f))) {
    const bText = atBase(file);
    const tText = inTree(file);
    if (tText === null) {
      add({ kind: "baseline", file, hard: true, detail: "the known-violations file of the import graph was deleted", fix: `git checkout ${base} -- ${file}` });
      continue;
    }
    const bList = safeJson(bText);
    const tList = safeJson(tText);
    if (!Array.isArray(tList)) {
      add({ kind: "baseline", file, hard: true, detail: "the known-violations file is not a JSON array", fix: "Restore a valid file." });
      continue;
    }
    const bCount = Array.isArray(bList) ? bList.length : 0;
    if (tList.length > bCount) add({ kind: "baseline", file, hard: true, detail: `known import-graph violations rose ${bCount} → ${tList.length}`, fix: "A cycle, an orphan or a boundary arrow is fixed, never recorded as known at night. Undo the step and split differently." });
  }

  // C. Coverage thresholds: per key, in order, a number never falls; autoUpdate never appears.
  for (const file of baseFiles.filter((f) => /(^|\/)(vitest|jest)(\.[\w-]+)*\.config\.(ts|js|mjs|mts|cjs)$/.test(f))) {
    const bText = atBase(file) || "";
    const tText = inTree(file);
    if (tText === null) continue;
    if (/autoUpdate\s*:\s*true/.test(tText) && !/autoUpdate\s*:\s*true/.test(bText)) {
      add({ kind: "threshold", file, hard: true, detail: "thresholds.autoUpdate: true appeared", fix: "Remove it: a tool raising the floor erases who moved it and why (FLOW.3)." });
    }
    for (const key of ["lines", "branches", "functions", "statements"]) {
      const bn = thresholdNumbers(bText, key);
      const tn = thresholdNumbers(tText, key);
      if (!bn.length) continue;
      if (tn.length < bn.length) add({ kind: "threshold", file, key: `${file}:${key}`, detail: `${key}: ${bn.length} threshold(s) on ${base}, ${tn.length} now`, fix: `Restore the threshold, or record a decision naming ${file}:${key} with the reason.` });
      bn.forEach((bv, i) => {
        if (tn[i] !== undefined && tn[i] < bv) add({ kind: "threshold", file, key: `${file}:${key}`, detail: `${key} threshold #${i + 1} fell ${bv} → ${tn[i]}`, fix: `Never lower a floor to go green. Restore it; if the figure flaps between runs, record a decision naming ${file}:${key} with both readings.` });
      });
    }
  }

  // D. ESLint: per rule, the count of blocks at error/warn never falls and the count at off never
  // rises; the ignores set never grows. Under --max-warnings=0 a warn is as blocking as an error.
  const rootPkgBase = safeJson(atBase("package.json"));
  const warnIsOn = Object.values(rootPkgBase?.scripts || {}).some((v) => /max-warnings[= ]0/.test(String(v)));
  for (const file of baseFiles.filter((f) => /(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts)$/.test(f))) {
    const bText = atBase(file) || "";
    const tText = inTree(file);
    if (tText === null) {
      add({ kind: "eslint", file, hard: true, detail: "the ESLint config was deleted", fix: `git checkout ${base} -- ${file}` });
      continue;
    }
    const b = ruleCounts(bText, warnIsOn);
    const t = ruleCounts(tText, warnIsOn);
    for (const [rule, bc] of b) {
      const tc = t.get(rule) || { on: 0, off: 0 };
      if (tc.on < bc.on) add({ kind: "eslint", file, key: rule, detail: `${rule}: ${bc.on} block(s) at error/warn on ${base}, ${tc.on} now`, fix: `Restore the rule, or record a decision that names "${rule}" and the reason (a deliberate per-directory exemption is allowed with one).` });
      else if (tc.off > bc.off) add({ kind: "eslint", file, key: rule, detail: `${rule}: switched off in ${tc.off - bc.off} more block(s)`, fix: `Restore it, or record a decision that names "${rule}" and the reason.` });
    }
    const bi = ignoreEntries(bText);
    for (const entry of ignoreEntries(tText)) {
      if (!bi.has(entry)) add({ kind: "eslint", file, key: entry, detail: `"${entry}" was added to ignores`, fix: `Lint it, or record a decision naming "${entry}" and why it is out of scope.` });
    }
  }

  // E. Lint scripts keep --max-warnings=0; the guarded scripts keep existing.
  for (const file of ["package.json", ...baseFiles.filter((f) => /^(apps|packages|services)\/[^/]+\/package\.json$/.test(f))]) {
    const b = safeJson(atBase(file));
    if (!b) continue;
    const t = safeJson(inTree(file));
    if (!t) {
      add({ kind: "scripts", file, hard: true, detail: "package.json is missing or unreadable", fix: `git checkout ${base} -- ${file}` });
      continue;
    }
    for (const [name, val] of Object.entries(b.scripts || {})) {
      const now = t.scripts?.[name];
      if (/max-warnings[= ]0/.test(String(val)) && !/max-warnings[= ]0/.test(String(now || ""))) add({ kind: "scripts", file, key: name, hard: true, detail: `"${name}" no longer runs with --max-warnings=0`, fix: "Put --max-warnings=0 back: a warning is a failure (CODE.4)." });
      else if (GUARDED_SCRIPTS.includes(name) && now === undefined) add({ kind: "scripts", file, key: name, hard: true, detail: `script "${name}" was removed`, fix: "Restore it." });
      // knip (CODE.6): --max-issues only falls, --no-exit-code never appears. depcruise (CODE.5):
      // --ignore-known is the intended flag, a dropped --output-type err is not.
      if (/\bknip\b/.test(String(val)) && now !== undefined) {
        const was = maxIssues(String(val));
        const is = maxIssues(String(now));
        if (is > was) add({ kind: "scripts", file, key: name, hard: true, detail: `"${name}": knip --max-issues rose ${was} → ${is}`, fix: "Dead code is removed, never allowed for. Delete the unused export or file (CODE.6)." });
        if (!/--no-exit-code/.test(String(val)) && /--no-exit-code/.test(String(now))) add({ kind: "scripts", file, key: name, hard: true, detail: `"${name}": knip gained --no-exit-code`, fix: "Remove it: a dead-code finding is a failure (CODE.6)." });
      }
      if (/\bdepcruise\b/.test(String(val)) && now !== undefined && /--output-type err/.test(String(val)) && !/--output-type err/.test(String(now))) add({ kind: "scripts", file, key: name, hard: true, detail: `"${name}": depcruise no longer exits non-zero on a violation (--output-type err dropped)`, fix: "Put --output-type err back (CODE.5)." });
    }
  }

  // F. tsconfig: a strict flag that was true stays true.
  for (const file of baseFiles.filter((f) => /(^|\/)tsconfig(\.[\w-]+)*\.json$/.test(f))) {
    const bText = atBase(file) || "";
    const tText = inTree(file);
    if (tText === null) {
      add({ kind: "tsconfig", file, key: file, detail: "the tsconfig was deleted", fix: `Restore it, or record a decision naming ${file}.` });
      continue;
    }
    for (const flag of STRICT_FLAGS) {
      if (lastFlag(bText, flag) === true && lastFlag(tText, flag) !== true) add({ kind: "tsconfig", file, key: flag, detail: `"${flag}" was true on ${base} and is not now`, fix: `Restore "${flag}", or record a decision naming it (the standard migrates towards strict, never away).` });
    }
  }

  // G. The instrument's files stay, and the pre-push hook still runs the gate.
  const gateFile = (String(config.commands?.gate || "").match(/^node\s+(\S+)/) || [])[1];
  for (const file of baseFiles.filter((f) => INSTRUMENT_FILE.test(f) || CI_FILE.test(f) || f === gateFile)) {
    if (inTree(file) !== null) continue;
    const hard = /pre-push$|gate\.(mjs|js|ts)$|standards/.test(file) || file === gateFile;
    add({ kind: "instrument", file, key: file, hard, detail: `${file} was deleted`, fix: hard ? `git checkout ${base} -- ${file}` : `Restore it, or record a decision naming ${file}.` });
  }
  for (const file of baseFiles.filter((f) => /(^|\/)pre-push$/.test(f))) {
    const bText = atBase(file) || "";
    const tText = inTree(file);
    if (tText !== null && /gate/.test(bText) && !/gate/.test(tText)) add({ kind: "instrument", file, hard: true, detail: "the pre-push hook no longer mentions the gate", fix: `git checkout ${base} -- ${file}` });
  }
  for (const file of baseFiles.filter((f) => CI_FILE.test(f))) {
    const b = ((atBase(file) || "").match(/failure\s*:\s*ignore/g) || []).length;
    const t = ((inTree(file) || "").match(/failure\s*:\s*ignore/g) || []).length;
    if (t > b) add({ kind: "ci", file, key: file, detail: `"failure: ignore" appears ${t - b} more time(s)`, fix: `A CI step made non-blocking is a lowered gate. Restore it, or record a decision naming ${file}.` });
  }

  const decisions = inTree(config.files?.decisions || "docs/ADOPTION_DECISIONS.md") || "";
  const cured = (f) => !f.hard && Boolean(f.key) && decisions.includes(f.key);
  return { ok: true, base, blocking: findings.filter((f) => !cured(f)), recorded: findings.filter(cured) };
}

/** The lines the Stop gate puts on stderr and the runner prints. */
export function formatDirection(result) {
  const lines = [];
  if (!result.ok) return [`[direction] cannot judge: ${result.error}`];
  if (result.blocking.length) {
    lines.push(`[direction] ${result.blocking.length} loosening(s) against ${result.base} - a gate that is green this way is not green:`);
    for (const f of result.blocking) lines.push(`- ${f.kind} · ${f.file} · ${f.detail}. ${f.fix}`);
  }
  if (result.recorded.length) {
    lines.push(`[direction] ${result.recorded.length} loosening(s) with a decision naming it (the morning reads them):`);
    for (const f of result.recorded) lines.push(`- ${f.kind} · ${f.file} · ${f.detail}`);
  }
  if (!lines.length) lines.push(`[direction] nothing loosened against ${result.base}`);
  return lines;
}

// ---- readers -------------------------------------------------------------------------------

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** Map of dotted path → number for every numeric leaf. */
function numericLeaves(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === "number") out.set(prefix + k, v);
    else if (v && typeof v === "object") numericLeaves(v, `${prefix}${k}.`, out);
  }
  return out;
}

function safeJson(text) {
  try {
    return text ? parseJsonText(text) : null;
  } catch {
    return null;
  }
}

/**
 * What a change to the root config loosened, by key: every change except a tightening of the
 * ratchet (a probe enabled, a metric made HARD, a metric no longer held as a ratchet) is named.
 * A file that does not parse on either side is named as unreadable rather than read as tight.
 */
function configLoosenings(baseText, treeText) {
  const a = safeJson(baseText);
  const b = safeJson(treeText);
  if (!a || !b) return ["the file does not parse on one side"];
  const list = (o, k) => (Array.isArray(o?.ratchet?.[k]) ? o.ratchet[k].map(String) : []);
  const out = [];
  // Growing: enable, hard. Shrinking: ratchet (a metric held as a ratchet instead of HARD).
  if (list(a, "enable").some((x) => !list(b, "enable").includes(x))) out.push("ratchet.enable lost an entry");
  if (list(a, "hard").some((x) => !list(b, "hard").includes(x))) out.push("ratchet.hard lost an entry");
  if (list(b, "ratchet").some((x) => !list(a, "ratchet").includes(x))) out.push("ratchet.ratchet gained an entry");
  const rest = (o) => {
    const copy = JSON.parse(JSON.stringify(o));
    if (copy.ratchet) for (const k of ["enable", "hard", "ratchet"]) delete copy.ratchet[k];
    return copy;
  };
  const ra = rest(a);
  const rb = rest(b);
  for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)]))
    if (JSON.stringify(ra[k]) !== JSON.stringify(rb[k])) out.push(`${k} changed`);
  return out;
}

/** Numbers for `key:` inside every `thresholds: { ... }` block, in file order. */
function thresholdNumbers(text, key) {
  const out = [];
  const re = /thresholds\s*:\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
    }
    const block = text.slice(m.index, i);
    const kre = new RegExp(`\\b${key}\\s*:\\s*([\\d.]+)`, "g");
    let k;
    while ((k = kre.exec(block))) out.push(Number(k[1]));
  }
  return out;
}

/** Per rule name: how many blocks set it on (error, or warn under --max-warnings=0) and off. */
function ruleCounts(text, warnIsOn) {
  const counts = new Map();
  const re = /["']?([@A-Za-z][\w./-]*)["']?\s*:\s*(?:\[\s*)?["']?(error|warn|off|0|1|2)["']?/g;
  let m;
  while ((m = re.exec(text))) {
    const rule = m[1];
    const sev = m[2];
    const on = sev === "error" || sev === "2" || (warnIsOn && (sev === "warn" || sev === "1"));
    const off = sev === "off" || sev === "0";
    const c = counts.get(rule) || { on: 0, off: 0 };
    if (on) c.on++;
    if (off) c.off++;
    counts.set(rule, c);
  }
  return counts;
}

/** Every string literal inside `ignores: [...]` and `globalIgnores([...])`. */
function ignoreEntries(text) {
  const out = new Set();
  const re = /(?:\bignores\s*:|\bglobalIgnores\s*\()\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(text))) {
    const lit = /["'`]([^"'`]+)["'`]/g;
    let s;
    while ((s = lit.exec(m[1]))) out.add(s[1]);
  }
  return out;
}

/** The last `"flag": true|false` in a (jsonc) tsconfig, or undefined. */
/** The number after --max-issues in a knip script, 0 when absent (knip's own default). */
function maxIssues(script) {
  const m = script.match(/--max-issues[= ](\d+)/);
  return m ? Number(m[1]) : 0;
}

function lastFlag(text, flag) {
  const re = new RegExp(`"${flag}"\\s*:\\s*(true|false)`, "g");
  let m;
  let last;
  while ((m = re.exec(text))) last = m[1] === "true";
  return last;
}

// ---- CLI -----------------------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--base");
  const base = i >= 0 ? args[i + 1] : process.env.ADOPTION_BASE || undefined;
  const result = checkDirection({ base });
  if (args.includes("--json")) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  else process.stdout.write(formatDirection(result).join("\n") + "\n");
  process.exit(!result.ok ? 1 : result.blocking.length ? 2 : 0);
}
