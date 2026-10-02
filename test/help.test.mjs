import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cli, tempRepo } from "./helpers.mjs";
import { presets } from "../src/presets/index.mjs";
import { renderHelp } from "../src/ui/help.mjs";

/** The commands the entry point dispatches, read from its own list. */
const KNOWN = (() => {
  const bin = readFileSync(fileURLToPath(new URL("../bin/abatty.mjs", import.meta.url)), "utf8");
  const list = bin.match(/const KNOWN = \[([^\]]*)\]/)?.[1] || "";
  return [...list.matchAll(/"([^"]+)"/g)]
    .map((m) => String(m[1]))
    .filter((c) => !c.startsWith("-"));
})();

const HELP = renderHelp({ version: "0.0.0", presets }).replace(/\x1b\[[0-9;]*m/g, "");

/** The commands with no line of their own in the help. @param {string[]} commands */
const undocumented = (commands) =>
  commands.filter(
    (c) =>
      !["help", "status"].includes(c) && !new RegExp(`^\\s*abatty ${c}(?![\\w-])`, "m").test(HELP),
  );

test("every command the entry point dispatches has a line in the help", () => {
  assert.ok(KNOWN.length > 30, `the list was read: ${KNOWN.length}`);
  assert.deepEqual(undocumented(KNOWN), []);
});

test("a command with no help line is named, so the check can go red", () => {
  assert.deepEqual(undocumented(["ratchet", "no-such-command"]), ["no-such-command"]);
});

test("a command's --help prints its own lines, never the whole screen nor a longer name's", () => {
  const dir = tempRepo("help-own", {});
  const ratchet = cli(["ratchet", dir, "--help", "--plain"], dir);
  assert.equal(ratchet.code, 0);
  assert.match(ratchet.out, /abatty ratchet \[dir\]/);
  assert.ok(!/abatty measure/.test(ratchet.out), "the global help was printed");
  const night = cli(["night", dir, "--help", "--plain"], dir);
  assert.match(night.out, /abatty night \[dir\]/);
  assert.ok(!/night-report/.test(night.out), "a longer name's line was printed");
});

test("--version and -v print the version alone, before any command could measure", () => {
  const dir = tempRepo("version", { "package.json": "{}" });
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
  );
  for (const args of [["--version"], ["-v"], ["gate", "--version"]]) {
    const r = cli(args, dir);
    assert.equal(r.code, 0, r.out);
    assert.equal(r.out, `${pkg.version}\n`, args.join(" "));
  }
});
