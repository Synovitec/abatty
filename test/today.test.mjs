/**
 * Dates are local, everywhere, because everything this package compares them against is local.
 *
 * The defect these cases exist for: `docs.behindCode` reported a document as behind code it had
 * been verified against on the same day, because the probe's same-day guard compared a UTC
 * "today" against git's `%cs`, which is the committer's local day. Invisible at Greenwich, real
 * for everybody else in the offset window either side of midnight, and a HARD metric, so it
 * failed a gate. Every case here pins a timezone, because a suite that only runs at UTC cannot
 * see any of it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localToday } from "../src/core/today.mjs";
import { buildContext } from "../src/rules/context.mjs";
import { BUILTIN_PROBES, DEFAULT_CONFIG, measureAll } from "../src/ratchet/index.mjs";
import { NEXT_PKG, git, inTimezone, tempRepo } from "./helpers.mjs";

/**
 * A timezone whose calendar day differs from UTC's RIGHT NOW, whatever the hour.
 *
 * Without this the cases below are only sometimes a test: between roughly 07:00 and 11:00 UTC no
 * ordinary zone disagrees with UTC about the date, so a suite pinned to named cities would run
 * green against the very bug it exists for. Twelve hours either way always disagrees.
 */
const skewed = () => (new Date().getUTCHours() < 12 ? "Etc/GMT+12" : "Etc/GMT-12");

test("localToday reads the local calendar, not UTC's", () => {
  // An instant that is one day in one zone and the day before in another. Pinned rather than
  // `new Date()`, so this case says the same thing at every hour of the day it runs.
  const instant = new Date("2026-09-19T23:30:00Z");
  assert.equal(
    inTimezone("UTC", () => localToday(instant)),
    "2026-09-19",
  );
  assert.equal(
    inTimezone("Europe/Paris", () => localToday(instant)),
    "2026-09-20",
  );
  assert.equal(
    inTimezone("Pacific/Auckland", () => localToday(instant)),
    "2026-09-20",
  );
  assert.equal(
    inTimezone("America/Los_Angeles", () => localToday(instant)),
    "2026-09-19",
  );
});

test("the context's today is the local day, in every timezone", () => {
  const dir = tempRepo("today-context", { "package.json": NEXT_PKG });
  for (const tz of ["UTC", "Europe/Paris", "Pacific/Auckland", "America/Los_Angeles", skewed()])
    inTimezone(tz, () => {
      assert.equal(buildContext(dir).today, localToday(), tz);
    });
  // and the one that decides it: a zone whose day is not UTC's, so a UTC "today" cannot pass
  inTimezone(skewed(), () => {
    assert.notEqual(buildContext(dir).today, new Date().toISOString().slice(0, 10));
  });
});

test("the context's today is the day git records for a commit made now", () => {
  // The contract the same-day guard rests on, and the exact pair that disagreed: git writes `%cs`
  // in the committer's local zone, and `docs.behindCode` compares it against `c.today`. If those
  // two are not the same calendar, the guard misses and a hard metric fails a gate for anybody
  // not at Greenwich. Asserted directly, so it bites at every hour rather than only near midnight.
  for (const tz of ["UTC", "Europe/Paris", "America/Los_Angeles", skewed()])
    inTimezone(tz, () => {
      const dir = tempRepo(`today-git-${tz.replace(/\W/g, "")}`, { "package.json": NEXT_PKG });
      assert.equal(buildContext(dir).today, git(dir, "log", "-1", "--format=%cs"), tz);
    });
});

test("a document verified today is not behind code committed today, wherever you are", () => {
  // The exact shape of the defect, end to end through the probe. git writes `%cs` in the
  // committer's local zone; the front matter carries the same local day; the probe's same-day
  // guard has to agree with both.
  for (const tz of ["Pacific/Auckland", "Europe/Paris", "UTC", "America/Los_Angeles", skewed()])
    inTimezone(tz, () => {
      const dir = tempRepo(`today-behind-${tz.replace(/\W/g, "")}`, {
        "package.json": NEXT_PKG,
        "src/x.ts": "export const x = 1;\n",
        "docs/a.md": `---\ntitle: "a"\nlast_verified: "${localToday()}"\nsource_truth:\n  - "src/x.ts"\n---\n\n# a\n`,
      });

      const [behind] = measureAll(
        BUILTIN_PROBES.filter((p) => p.metric === "docs.behindCode"),
        buildContext(dir),
        { config: DEFAULT_CONFIG, range: "" },
        null,
      );
      assert.equal(
        behind?.value,
        0,
        `${tz}: ${behind?.findings.map((f) => `${f.path} ${f.detail}`).join("; ")}`,
      );
    });
});
