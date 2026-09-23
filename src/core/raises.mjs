/**
 * A floor that rose, and the one approval that can let it land. `abatty baseline` asks for a
 * reason and an owner, and an agent session types a person's name as easily as the person does;
 * the baseline is a JSON file it can also edit by hand. Nothing written on the machine that
 * raised the floor can approve the raise, so the approval is the forge's: a review that approves
 * the pull request's current head, by somebody other than its author. The raiser cannot give
 * that one to itself, since a forge does not let an author approve their own pull request.
 */
import { spawnSync } from "node:child_process";
import { git, readAdoption } from "./repo.mjs";
import { baselinePath } from "../ratchet/config.mjs";
import { readBaseline } from "../ratchet/baseline.mjs";

/**
 * @typedef {{ metric: string, was: number, now: number | null, how: "rose" | "vanished" | "no longer hard" }} Loosened
 * @typedef {{ approved: boolean, by: string[], detail: string }} Approval
 * @typedef {(args: string[]) => { ok: boolean, stdout: string }} Gh
 */

/**
 * Every floor the working baseline loosened against the one on `base`: a number above the base's,
 * a metric the base had and this one dropped, a HARD metric demoted. A base with no baseline
 * loosens nothing, since there was no floor to raise.
 * @param {string} repoDir @param {string} base @returns {{ base: string, found: boolean, loosened: Loosened[] }}
 */
export function floorRises(repoDir, base) {
  const rel = baselinePath(readAdoption(repoDir));
  const text = git(repoDir, "show", `${base}:${rel}`);
  /** @type {import("../ratchet/index.mjs").Baseline | null} */
  let before = null;
  try {
    before = text ? JSON.parse(text) : null;
  } catch {
    before = null;
  }
  const now = readBaseline(repoDir, rel);
  if (!before?.metrics) return { base, found: false, loosened: [] };
  /** @type {Loosened[]} */
  const loosened = [];
  for (const [metric, was] of Object.entries(before.metrics)) {
    const v = now?.metrics?.[metric];
    if (typeof v !== "number") loosened.push({ metric, was, now: null, how: "vanished" });
    else if (v > was) loosened.push({ metric, was, now: v, how: "rose" });
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
  return { base, found: true, loosened: loosened.sort((a, b) => a.metric.localeCompare(b.metric)) };
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
