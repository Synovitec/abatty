/**
 * A floor that rose, and the one approval that can let it land. `abatty baseline` asks for a
 * reason and an owner, and an agent session types a person's name as easily as the person does;
 * the baseline is a JSON file it can also edit by hand. Nothing written on the machine that
 * raised the floor can approve the raise, so the approval is the forge's: a review that approves
 * the pull request's current head, by somebody other than its author. The raiser cannot give
 * that one to itself, since a forge does not let an author approve their own pull request.
 */
import { spawnSync } from "node:child_process";
import { CONFIG_FILE, LEGACY_CONFIG, git, readAdoption, readJsonFile } from "./repo.mjs";
import { baselinePath } from "../ratchet/config.mjs";
import { readBaseline } from "../ratchet/baseline.mjs";

/**
 * @typedef {{ metric: string, was: number | string, now: number | string | null, how: "rose" | "vanished" | "no longer hard" | "rose in a file" | "config", path?: string }} Loosened
 * @typedef {{ approved: boolean, by: string[], detail: string }} Approval
 * @typedef {(args: string[]) => { ok: boolean, stdout: string }} Gh
 */

/** A JSON file as the base branch has it, or null. @param {string} repoDir @param {string} base @param {string} rel */
function onBase(repoDir, base, rel) {
  try {
    const text = git(repoDir, "show", `${base}:${rel}`);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Every floor the working baseline and config loosened against `base`: a total above the base's,
 * a file's debt above its own floor or a file newly carrying some (debt moved is debt loosened),
 * a metric dropped, a HARD metric demoted, and the config's ways to the same end (see
 * `configLoosened`). A base with no baseline loosens nothing, since there was no floor to raise.
 * @param {string} repoDir @param {string} base @returns {{ base: string, found: boolean, loosened: Loosened[] }}
 */
export function floorRises(repoDir, base) {
  const rel = baselinePath(readAdoption(repoDir));
  /** @type {import("../ratchet/index.mjs").Baseline | null} */
  const before = onBase(repoDir, base, rel);
  const now = readBaseline(repoDir, rel);
  if (!before?.metrics) return { base, found: false, loosened: [] };
  /** @type {Loosened[]} */
  const loosened = [];
  for (const [metric, was] of Object.entries(before.metrics)) {
    const v = now?.metrics?.[metric];
    if (typeof v !== "number") loosened.push({ metric, was, now: null, how: "vanished" });
    else if (v > was) loosened.push({ metric, was, now: v, how: "rose" });
    const debtWas = before.debt?.[metric] || {};
    for (const [path, n] of Object.entries(now?.debt?.[metric] || {}))
      if (n > (debtWas[path] ?? 0))
        loosened.push({ metric, was: debtWas[path] ?? 0, now: n, how: "rose in a file", path });
  }
  const hardNow = new Set(now?.hard || []);
  for (const metric of before.hard || [])
    if (!hardNow.has(metric) && typeof now?.metrics?.[metric] === "number")
      loosened.push({
        metric,
        was: before.metrics[metric] ?? 0,
        now: now.metrics[metric] ?? 0,
        how: "no longer hard",
      });
  loosened.push(...configLoosened(repoDir, base));
  return { base, found: true, loosened: loosened.sort((a, b) => a.metric.localeCompare(b.metric)) };
}

/**
 * The config's ways to loosen a floor without touching the baseline: a metric excluded, a path
 * exempted, a metric held as a ratchet instead of hard or taken off the hard list, an opt-in
 * probe switched off, a cap or a budget raised. Each is the same decision as a raised number.
 * @param {string} repoDir @param {string} base @returns {Loosened[]}
 */
function configLoosened(repoDir, base) {
  const file = readJsonFile(repoDir, CONFIG_FILE) ? CONFIG_FILE : LEGACY_CONFIG;
  const was = onBase(repoDir, base, file)?.ratchet;
  const now = readJsonFile(repoDir, file)?.ratchet;
  if (!was || typeof was !== "object") return [];
  const list = (/** @type {any} */ r, /** @type {string} */ k) =>
    Array.isArray(r?.[k]) ? r[k].map(String) : [];
  /** @type {Loosened[]} */
  const out = [];
  /** @param {string} key @param {string[]} from @param {string[]} to */
  const grew = (key, from, to) => {
    for (const v of to.filter((x) => !from.includes(x)))
      out.push({ metric: `ratchet.${key}`, was: "", now: v, how: "config" });
  };
  grew("exclude", list(was, "exclude"), list(now, "exclude"));
  grew("exempt", list(was, "exempt"), list(now, "exempt"));
  grew("ratchet", list(was, "ratchet"), list(now, "ratchet"));
  for (const [key, from, to] of /** @type {const} */ ([
    ["hard", list(was, "hard"), list(now, "hard")],
    ["enable", list(was, "enable"), list(now, "enable")],
  ]))
    for (const v of from.filter((x) => !to.includes(x)))
      out.push({ metric: `ratchet.${key}`, was: v, now: null, how: "config" });
  for (const key of ["cap", "defaultMax", "contextMax", "barrelMax"])
    if (typeof was[key] === "number" && typeof now?.[key] === "number" && now[key] > was[key])
      out.push({ metric: `ratchet.${key}`, was: was[key], now: now[key], how: "config" });
  for (const k of Array.isArray(now?.kinds) ? now.kinds : []) {
    const b = (Array.isArray(was.kinds) ? was.kinds : []).find(
      (/** @type {any} */ x) => x?.kind === k?.kind,
    );
    if (b && typeof k.max === "number" && k.max > b.max)
      out.push({ metric: `ratchet.kinds.${k.kind}`, was: b.max, now: k.max, how: "config" });
  }
  return out;
}

/** The forge's CLI, as the pipeline has it. @type {Gh} */
const ghCli = (args) => {
  const r = spawnSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, stdout: r.stdout || "" };
};

/**
 * Has somebody other than the author approved the pull request as it stands? Each reviewer's
 * latest review counts, and only an approval of the head commit: an approval given before the
 * floor moved approved something else.
 * @param {string} pr @param {Gh} [gh] @returns {Approval}
 */
export function reviewApproval(pr, gh = ghCli) {
  const r = gh(["pr", "view", pr, "--json", "author,headRefOid,reviews"]);
  if (!r.ok)
    return {
      approved: false,
      by: [],
      detail: `the forge could not be asked about pull request ${pr}`,
    };
  /** @type {{ author?: { login?: string }, headRefOid?: string, reviews?: { author?: { login?: string }, state?: string, submittedAt?: string, commit?: { oid?: string } }[] }} */
  let view;
  try {
    view = JSON.parse(r.stdout);
  } catch {
    return { approved: false, by: [], detail: `the forge's answer about ${pr} did not parse` };
  }
  const author = view.author?.login || "";
  /** @type {Map<string, { state?: string, commit?: { oid?: string } }>} */
  const latest = new Map();
  for (const rv of [...(view.reviews || [])].sort((a, b) =>
    String(a.submittedAt).localeCompare(String(b.submittedAt)),
  ))
    if (rv.author?.login && rv.state !== "COMMENTED") latest.set(rv.author.login, rv);
  const by = [...latest]
    .filter(
      ([login, rv]) =>
        login !== author && rv.state === "APPROVED" && rv.commit?.oid === view.headRefOid,
    )
    .map(([login]) => login);
  return {
    approved: by.length > 0,
    by,
    detail: by.length
      ? `approved at the head by ${by.join(", ")}`
      : `no approval of the head commit by anybody but ${author || "the author"}`,
  };
}
