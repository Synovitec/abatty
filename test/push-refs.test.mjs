import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { git, tempRepo } from "./helpers.mjs";
import { pushLines, pushPlan, refRange } from "../src/core/push-refs.mjs";

const ZERO = "0".repeat(40);
const HEAD = "a".repeat(40);
const OTHER = "b".repeat(40);
const REMOTE = "c".repeat(40);

test("each pushed ref is read: a deletion is skipped, the checkout is judged, another commit is refused", () => {
  const lines = pushLines(
    [
      `(delete) ${ZERO} refs/heads/old ${REMOTE}`,
      `refs/heads/feat ${HEAD} refs/heads/feat ${REMOTE}`,
      `refs/heads/other ${OTHER} refs/heads/other ${ZERO}`,
      "not a line git writes",
    ].join("\n"),
  );
  assert.equal(lines.length, 3, "a malformed line is dropped");
  const plan = pushPlan(lines, HEAD);
  assert.equal(plan.skipped.length, 1);
  assert.match(plan.skipped[0] || "", /deletion carries nothing/);
  assert.deepEqual(
    plan.judge.map((l) => l.remote),
    ["refs/heads/feat"],
  );
  assert.equal(plan.refused.length, 1);
  assert.match(
    plan.refused[0] || "",
    /refs\/heads\/other .* not the aaaaaaaaaaaa checked out here/,
  );
});

test("a tag is judged as the commit it names: the checkout's is gated, another is refused", () => {
  const TAG = "d".repeat(40); // an annotated tag's own object, naming HEAD
  const peel = (/** @type {string} */ sha) => (sha === TAG ? HEAD : sha);
  const lines = pushLines(
    [
      `refs/tags/v2 ${TAG} refs/tags/v2 ${ZERO}`,
      `refs/tags/v1 ${OTHER} refs/tags/v1 ${ZERO}`,
      `refs/tags/gone ${ZERO} refs/tags/gone ${REMOTE}`,
    ].join("\n"),
  );
  const plan = pushPlan(lines, HEAD, peel);
  assert.deepEqual(
    plan.judge.map((l) => [l.remote, l.localSha]),
    [["refs/tags/v2", HEAD]],
  );
  assert.equal(
    plan.refused.length,
    1,
    "a tag on commits no branch push carried is not waved through",
  );
  assert.match(plan.refused[0] || "", /refs\/tags\/v1/);
  assert.match(plan.skipped[0] || "", /deletion/);
});

test("the range a judged ref adds: from what the remote had, or from where a new branch left the base", () => {
  const [known, fresh] = pushLines(`x ${HEAD} y ${REMOTE}\nx ${HEAD} y ${ZERO}`);
  assert.ok(known && fresh);
  assert.equal(refRange(known, "m"), `${REMOTE}..${HEAD}`);
  assert.equal(refRange(fresh, "m"), `m..${HEAD}`);
  assert.equal(refRange(fresh, ""), "", "no merge base: the gate finds the range itself");
});

/** `abatty gate --refs` in `dir` with `stdin`. @param {string} dir @param {string} stdin */
function gateRefs(dir, stdin) {
  const bin = new URL("../bin/abatty.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
  const r = spawnSync(process.execPath, [bin, "gate", dir, "--refs", "--stack", "node"], {
    cwd: dir,
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, ADOPTION_RUN: "", ADOPTION_CONFIG: "" },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

test("a push of deletions only runs no gate; a push of a commit not checked out is refused", () => {
  // A script that would fail proves the gate did not run at all.
  const dir = tempRepo("refs-cli", {
    "package.json": JSON.stringify({
      name: "r",
      scripts: { test: "node -e process.exit(1)", standards: "node -e 0" },
    }),
  });
  const head = git(dir, "rev-parse", "HEAD");
  const deletion = gateRefs(dir, `(delete) ${ZERO} refs/heads/gone ${REMOTE}\n`);
  assert.equal(deletion.code, 0, deletion.out);
  assert.match(deletion.out, /nothing pushed that the gate judges/);
  assert.doesNotMatch(deletion.out, /unit tests/);
  // on a checkout whose gate is green, so only a refusal can make the push fail
  const green = tempRepo("refs-green", {
    "package.json": JSON.stringify({
      name: "g",
      scripts: { test: "node -e 0", standards: "node -e 0" },
    }),
    "package-lock.json": "{}\n",
  });
  const other = gateRefs(green, `refs/heads/x ${OTHER} refs/heads/x ${ZERO}\n`);
  assert.equal(other.code, 3, other.out);
  assert.match(other.out, /not the .* checked out here/);
  // and the checkout itself is judged: the failing test script turns it red
  const own = gateRefs(dir, `refs/heads/main ${head} refs/heads/main ${ZERO}\n`);
  assert.notEqual(own.code, 0, own.out);
  assert.match(own.out, /unit tests/);
});

test("an annotated tag on the checkout is gated, and two refs are judged over the older base", () => {
  const dir = tempRepo("refs-tag", {
    "package.json": JSON.stringify({
      name: "t",
      scripts: { test: "node -e 0", standards: "node -e 0" },
    }),
    "package-lock.json": "{}\n",
  });
  const first = git(dir, "rev-parse", "HEAD");
  git(dir, "commit", "-q", "--allow-empty", "-m", "two");
  const second = git(dir, "rev-parse", "HEAD");
  git(dir, "commit", "-q", "--allow-empty", "-m", "three");
  const head = git(dir, "rev-parse", "HEAD");
  git(dir, "tag", "-a", "v1", "-m", "release");
  const tagObject = git(dir, "rev-parse", "v1");
  assert.notEqual(tagObject, head, "an annotated tag has its own object");
  const tag = gateRefs(dir, `refs/tags/v1 ${tagObject} refs/tags/v1 ${ZERO}\n`);
  assert.doesNotMatch(tag.out, /nothing pushed that the gate judges|not the .* checked out/);
  assert.match(tag.out, /unit tests/);
  const two = gateRefs(
    dir,
    `refs/heads/main ${head} refs/heads/main ${second}\nrefs/heads/b ${head} refs/heads/b ${first}\n`,
  );
  assert.match(two.out, new RegExp(`range ${first}\.\.${head}`));
});
