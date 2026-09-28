import { test } from "node:test";
import assert from "node:assert/strict";
import { tempRepo } from "./helpers.mjs";
import { compareVersions, pinBehindLine, runningVersion } from "../src/core/pin-behind.mjs";
import { runGate } from "../src/core/gate.mjs";

// An adopter's branch moved the pin to a new abatty while node_modules still held the old one;
// the gate judged every push with the older instrument and nothing said so.

/** @param {string} pin */
const config = (pin) => JSON.stringify({ abatty: pin });
/** @param {string} v */
const installed = (v) => JSON.stringify({ name: "abatty", version: v });

test("versions compare by SemVer precedence, pre-releases before their release", () => {
  const ordered = [
    "0.6.1",
    "0.7.0-rc.1",
    "0.7.0-rc.2",
    "0.7.0-rc.10",
    "0.7.0",
    "0.7.1",
    "0.10.0",
    "1.0.0",
  ];
  for (const [i, later] of ordered.entries()) {
    const earlier = ordered[i - 1];
    if (earlier === undefined) continue;
    assert.ok(compareVersions(earlier, later) < 0, `${earlier} < ${later}`);
    assert.ok(compareVersions(later, earlier) > 0, `${later} > ${earlier}`);
  }
  assert.equal(compareVersions("0.7.0-rc.3", "0.7.0-rc.3"), 0);
  assert.ok(compareVersions("1.0.0-alpha", "1.0.0-alpha.1") < 0);
  assert.ok(compareVersions("1.0.0-1", "1.0.0-alpha") < 0);
});

test("an installed abatty older than the pin is named, with the install to run", () => {
  const dir = tempRepo("pin-behind", {
    "abatty.config.json": config("0.7.0-rc.3"),
    "node_modules/abatty/package.json": installed("0.7.0-rc.1"),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  });
  const line = pinBehindLine(dir, "0.7.0-rc.1");
  assert.match(
    line,
    /node_modules\/abatty is 0\.7\.0-rc\.1, older than the 0\.7\.0-rc\.3 abatty\.config\.json pins/,
  );
  assert.match(line, /pnpm install/);
  assert.doesNotMatch(
    line,
    /the abatty running/,
    "the copy running is the installed one, named once",
  );
});

test("an installed abatty at or past the pin says nothing", () => {
  for (const v of ["0.7.0-rc.3", "0.7.0"]) {
    const dir = tempRepo("pin-level", {
      "abatty.config.json": config("0.7.0-rc.3"),
      "node_modules/abatty/package.json": installed(v),
    });
    assert.equal(pinBehindLine(dir, v), "", v);
  }
});

test("with no installed copy the running package is judged, and no pin says nothing", () => {
  const dir = tempRepo("pin-running", { "abatty.config.json": config("0.8.0") });
  assert.match(
    pinBehindLine(dir, "0.7.0"),
    /the abatty running is 0\.7\.0, older than the 0\.8\.0/,
  );
  assert.equal(pinBehindLine(dir, "0.8.0"), "");
  assert.equal(pinBehindLine(tempRepo("pin-none", {}), "0.1.0"), "");
});

test("the running version is this package's own", () => {
  assert.match(runningVersion(), /^\d+\.\d+\.\d+/);
});

test("the gate prints the line before its first step, and only when the install is behind", () => {
  const preset = /** @type {import("../src/presets/index.mjs").Preset} */ (
    /** @type {unknown} */ ({ id: "t", gate: { always: [], suites: [] } })
  );
  /** @param {Record<string, string>} files */
  const gateLog = (files) => {
    /** @type {string[]} */
    const lines = [];
    runGate({
      repoDir: tempRepo("pin-gate", files),
      preset,
      version: "0.7.0-rc.3",
      log: (l) => lines.push(l),
    });
    return lines.join("\n");
  };
  assert.match(
    gateLog({
      "abatty.config.json": config("0.7.0-rc.3"),
      "node_modules/abatty/package.json": installed("0.6.1"),
    }),
    /node_modules\/abatty is 0\.6\.1, older than the 0\.7\.0-rc\.3/,
  );
  assert.doesNotMatch(
    gateLog({
      "abatty.config.json": config("0.7.0-rc.3"),
      "node_modules/abatty/package.json": installed("0.7.0-rc.3"),
    }),
    /older than the/,
  );
});
