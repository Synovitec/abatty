import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { NEXT_PKG, tempRepo } from "./helpers.mjs";
import { buildReport } from "../src/core/report.mjs";
import {
  badgeSvg,
  createService,
  createStore,
  isReport,
  publishReport,
  safeName,
} from "../src/hosted/service.mjs";
import { eventsBetween, summariseEvents } from "../src/hosted/events.mjs";

/**
 * Run the CLI without blocking the event loop: the service under test lives in this process,
 * and a synchronous spawn would leave it unable to answer the child.
 * @param {string[]} args @param {string} cwd
 * @returns {Promise<{ code: number, out: string }>}
 */
function cliAsync(args, cwd) {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [new URL("../bin/abatty.mjs", import.meta.url).pathname, ...args],
      { cwd, env: { ...process.env, ADOPTION_RUN: "" } },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code: code ?? 1, out }));
  });
}

/** Start a service on an ephemeral port. @param {{ token?: string, noAuth?: boolean }} [o] */
async function started(o = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "abatty-hosted-"));
  const svc = createService({
    dataDir,
    token: o.token ?? "secret",
    noAuth: o.noAuth,
    abattyVersion: "test",
  });
  await new Promise((r) => svc.server.listen(0, "127.0.0.1", () => r(null)));
  const addr = /** @type {import("node:net").AddressInfo} */ (svc.server.address());
  return {
    ...svc,
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((r) => svc.server.close(() => r(null))),
  };
}

test("the store and the badge: a safe folder per repository, the newest reading per day, the badge in the score's band", () => {
  assert.equal(safeName("@org/my repo!"), "org-my-repo");
  assert.equal(safeName(""), "repository");
  const store = createStore(mkdtempSync(join(tmpdir(), "abatty-store-")));
  store.put({ name: "a", date: "2026-09-14", score: 40, findings: [] });
  store.put({ name: "a", date: "2026-09-15", score: 55, findings: [] });
  store.put({ name: "a", date: "2026-09-15", score: 60, findings: [] });
  assert.deepEqual(
    store.repos()[0]?.reports.map((r) => r.score),
    [40, 60],
    "the newest reading of a day wins",
  );
  assert.equal(store.repo("a")?.reports.length, 2);
  assert.equal(store.repo("zzz"), null);
  assert.match(badgeSvg("abatty", 95), /2f6f46/);
  assert.match(badgeSvg("abatty", 75), /a65a1e/);
  assert.match(badgeSvg("abatty", 20), /9d3535/);
  assert.match(badgeSvg("abatty", null), /no reading/);
  assert.equal(isReport({ name: "x", score: 1, findings: [] }), true);
  assert.equal(isReport({ name: "x" }), false);
  assert.throws(() => createService({ dataDir: "/tmp/x", token: "" }), /token is required/);
});

test("the service: a report posted with the token is stored and served on the page, the index, the repository route and the badge; without the token it is refused; a bad body is refused", async () => {
  const dir = tempRepo("hosted-post", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const report = await buildReport(dir, { write: false, abattyVersion: "test" });
  const s = await started();
  try {
    const health = await (await fetch(`${s.url}/healthz`)).json();
    assert.deepEqual(health, { ok: true, repositories: 0 });
    const denied = await fetch(`${s.url}/reports`, {
      method: "POST",
      body: JSON.stringify(report),
      headers: { "content-type": "application/json" },
    });
    assert.equal(denied.status, 401);
    const bad = await fetch(`${s.url}/reports`, {
      method: "POST",
      body: "{ nope",
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
    });
    assert.equal(bad.status, 400);
    const notReport = await fetch(`${s.url}/reports`, {
      method: "POST",
      body: JSON.stringify({ hello: 1 }),
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
    });
    assert.equal(notReport.status, 400);
    const posted = await publishReport({ url: s.url, token: "secret", report });
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    assert.equal(posted.body.stored.name, "fixture-next");
    const index = await (await fetch(`${s.url}/api/reports`)).json();
    assert.equal(index.length, 1);
    assert.equal(index[0].name, "fixture-next");
    assert.equal(index[0].score, report.score);
    const one = await (await fetch(`${s.url}/api/reports/fixture-next`)).json();
    assert.equal(one.reports[0].score, report.score);
    assert.equal((await fetch(`${s.url}/api/reports/ghost`)).status, 404);
    const page = await (await fetch(`${s.url}/`)).text();
    assert.match(page, /<title>abatty<\/title>/);
    assert.ok(page.includes("fixture-next"));
    const badge = await fetch(`${s.url}/badge/fixture-next.svg`);
    assert.equal(badge.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.ok((await badge.text()).includes(`${report.score}/100`));
    assert.equal((await fetch(`${s.url}/nope`)).status, 404);
    assert.ok(existsSync(join(s.store.root, "fixture-next", "latest.json")));
  } finally {
    await s.close();
  }
});

test("the CLI: abatty publish posts the newest report (measured now when there is none), and --no-auth serves without a token", async () => {
  const dir = tempRepo("hosted-cli", {
    "package.json": NEXT_PKG,
    "src/a.ts": "export const a = 1;\n",
  });
  const s = await started({ noAuth: true, token: "" });
  try {
    const r = await cliAsync(["publish", dir, "--to", s.url], dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /publish: 201/);
    assert.ok(existsSync(join(dir, ".abatty", "reports", "latest.json")), "measured now");
    const again = await cliAsync(["publish", dir, "--to", s.url], dir);
    assert.equal(again.code, 0, again.out);
    assert.equal(
      (await (await fetch(`${s.url}/api/reports`)).json())[0].readings,
      1,
      "the same day is one reading",
    );
    const noTarget = await cliAsync(["publish", dir], dir);
    assert.equal(noTarget.code, 2);
    assert.equal(
      readFileSync(join(s.store.root, "fixture-next", "latest.json"), "utf8").includes('"score"'),
      true,
    );
  } finally {
    await s.close();
  }
});

/** A reading, as the service stores one. @param {string} date @param {any[]} findings @param {object} [extra] */
const reading = (date, findings, extra = {}) => ({
  version: 1,
  name: "shop",
  repo: "shop",
  date,
  score: 50,
  applicable: findings.length,
  findings,
  ...extra,
});
/** @param {string} id @param {string} status @param {string} enforcement */
const rule = (id, status, enforcement = "hard") => ({
  id,
  family: "Code",
  rule: id,
  status,
  evidence: "e",
  next: "n",
  phase: "0",
  level: /** @type {const} */ ("must"),
  enforcement,
  standard: [],
});

test("adoption events are what changed between two readings, and a loss is an event as loud as a gain", () => {
  const first = reading("2026-09-01", [rule("A", "missing"), rule("B", "present")]);
  const second = reading("2026-09-02", [rule("A", "present"), rule("B", "missing")]);
  assert.deepEqual(
    eventsBetween(null, first).map((e) => e.kind),
    ["first-reading"],
    "a first reading is one event, not a hundred",
  );
  const e = eventsBetween(first, second);
  const held = e.find((x) => x.subject === "A");
  assert.equal(held?.kind, "rule-held");
  assert.equal(held?.from, "missing");
  assert.equal(held?.to, "present");
  const lost = e.find((x) => x.subject === "B");
  assert.equal(lost?.kind, "rule-lost", "a regression is an event, not a silence");
  assert.match(String(lost?.detail), /was present and now reads missing/);
  assert.equal(
    summariseEvents(e).regressions,
    1,
    "counted on its own so a dashboard cannot bury it",
  );
});

test("a rule moving up or down the enforcement ladder is an event, and an unchanged one is not", () => {
  const before = reading("2026-09-01", [
    rule("A", "present", "review"),
    rule("C", "present", "hard"),
  ]);
  const after = reading("2026-09-02", [rule("A", "present", "hard"), rule("C", "present", "hard")]);
  const e = eventsBetween(before, after);
  assert.deepEqual(
    e.map((x) => [x.kind, x.subject]),
    [["rule-promoted", "A"]],
    "only the one that moved",
  );
  const down = eventsBetween(after, before);
  assert.equal(down[0]?.kind, "rule-demoted");
  assert.equal(summariseEvents(down).regressions, 1);
  assert.deepEqual(eventsBetween(after, after), [], "nothing changed, nothing recorded");
});

test("a rule entering or leaving the catalog, a waiver starting and ending, and the phase moving", () => {
  const a = reading("2026-09-01", [rule("A", "present"), rule("GONE", "present")], {
    phase: { id: "0" },
  });
  const b = reading("2026-09-02", [rule("A", "waived"), rule("NEW", "partial")], {
    phase: { id: "1" },
  });
  const kinds = eventsBetween(a, b).map((x) => `${x.kind}:${x.subject}`);
  assert.ok(kinds.includes("waived:A"));
  assert.ok(kinds.includes("rule-added:NEW"));
  assert.ok(kinds.includes("rule-removed:GONE"));
  assert.ok(kinds.includes("phase:1"));
  const back = eventsBetween(b, a).map((x) => `${x.kind}:${x.subject}`);
  assert.ok(back.includes("waiver-ended:A"));
});

test("the service serves the events it derived, newest first, across every repository and per repository", async () => {
  const svc = await started({ noAuth: true });
  try {
    for (const r of [
      reading("2026-09-01", [rule("A", "missing")]),
      reading("2026-09-02", [rule("A", "present")]),
    ])
      await fetch(`${svc.url}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r),
      });
    const all = await (await fetch(`${svc.url}/api/events`)).json();
    assert.equal(all.total, 2, "the first reading, then the rule holding");
    assert.equal(all.events[0].at, "2026-09-02", "newest first");
    assert.equal(all.events[0].kind, "rule-held");
    assert.equal(all.events[0].repository, "shop");
    const one = await (await fetch(`${svc.url}/api/events/shop`)).json();
    assert.equal(one.repository, "shop");
    assert.equal(one.events[0].kind, "rule-held");
    assert.equal((await fetch(`${svc.url}/api/events/nope`)).status, 404);
  } finally {
    await svc.close();
  }
});
