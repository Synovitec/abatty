import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { TEMPLATES } from "../src/core/init.mjs";
import {
  BASE_DIR,
  LOCK,
  addMissingKeys,
  hashOf,
  mergeFile,
  readLock,
  updateRepo,
} from "../src/core/update.mjs";
import { presetById } from "../src/presets/index.mjs";

const preset = presetById("next");
const HOOK = ".claude/hooks/session-brief.mjs";
const NEW = readFileSync(join(TEMPLATES, "harness/hooks/session-brief.mjs"), "utf8");
// "The version before": the template without its last line, as if the package had grown one.
const OLD = NEW.split("\n").slice(0, -2).join("\n") + "\n";

/** A repository with the harness installed by an older package: the base copy and the lock say OLD. @param {string} name */
function installedOld(name) {
  const dir = tempRepo(name, { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const lock = readLock(dir);
  assert.ok(lock, "init wrote the lock");
  lock.abatty = "0.0.9";
  lock.files[HOOK] = hashOf(OLD);
  writeFileSync(join(dir, LOCK), JSON.stringify(lock, null, 2) + "\n");
  const base = join(dir, BASE_DIR, "0.0.9", HOOK);
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(base, OLD);
  writeFileSync(join(dir, HOOK), OLD);
  return dir;
}

test("init writes the lock and keeps the installed copies as the base of the next merge", () => {
  const dir = tempRepo("update-init", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const lock = readLock(dir);
  assert.ok(lock);
  assert.equal(
    lock.abatty,
    JSON.parse(readFileSync(join(TEMPLATES, "../package.json"), "utf8")).version,
  );
  assert.equal(lock.files[HOOK], hashOf(NEW));
  assert.ok(existsSync(join(dir, BASE_DIR, lock.abatty, HOOK)));
  assert.match(
    readFileSync(join(dir, ".gitignore"), "utf8"),
    /\.abatty\//,
    "the base copies are not committed",
  );
  const r = updateRepo({ repoDir: dir, preset });
  assert.ok(
    r.events.every((e) => e.action === "in step"),
    JSON.stringify(r.events.filter((e) => e.action !== "in step")),
  );
});

test("untouched since the install: the file takes the package's version", () => {
  const dir = installedOld("update-untouched");
  const r = updateRepo({ repoDir: dir, preset, version: "0.1.0" });
  assert.equal(r.from, "0.0.9");
  assert.equal(r.events.find((e) => e.file === HOOK)?.action, "updated");
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), NEW);
  assert.equal(readLock(dir)?.files[HOOK], hashOf(NEW), "the lock follows");
  assert.ok(existsSync(join(dir, BASE_DIR, "0.1.0", HOOK)), "the new base copy is kept");
});

test("edited here while the package did not change it: yours is kept", () => {
  const dir = tempRepo("update-kept", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const mine = "// my note\n" + NEW;
  writeFileSync(join(dir, HOOK), mine);
  const r = updateRepo({ repoDir: dir, preset });
  assert.equal(r.events.find((e) => e.file === HOOK)?.action, "kept");
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), mine);
});

test("both changed apart: the three-way merge keeps your edit and the package's change", () => {
  const dir = installedOld("update-merge");
  const mine = "// my note at the top\n" + OLD;
  writeFileSync(join(dir, HOOK), mine);
  const r = updateRepo({ repoDir: dir, preset, version: "0.1.0" });
  const e = r.events.find((x) => x.file === HOOK);
  assert.equal(e?.action, "merged", e?.detail);
  const after = readFileSync(join(dir, HOOK), "utf8");
  assert.ok(after.startsWith("// my note at the top\n"), "your edit");
  const lastLine = NEW.trimEnd().split("\n").pop() || "";
  assert.ok(after.trimEnd().endsWith(lastLine), "the package's new last line");
  assert.equal(r.conflicts, 0);
});

test("both changed on the same lines: a conflict leaves the new version beside yours and touches nothing of yours", () => {
  const dir = installedOld("update-conflict");
  const mine = OLD.split("\n").slice(0, -2).join("\n") + "\n// my own ending\n";
  writeFileSync(join(dir, HOOK), mine);
  const r = updateRepo({ repoDir: dir, preset, version: "0.1.0" });
  const e = r.events.find((x) => x.file === HOOK);
  assert.equal(e?.action, "conflict", e?.detail);
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), mine);
  assert.equal(readFileSync(join(dir, `${HOOK}.abatty-new`), "utf8"), NEW);
  assert.equal(r.conflicts, 1);
  // without the installed copy on this machine, the same both-changed case is a conflict too, and says why
  rmSync(join(dir, BASE_DIR), { recursive: true, force: true });
  rmSync(join(dir, `${HOOK}.abatty-new`));
  const lock = readLock(dir);
  assert.ok(lock);
  lock.abatty = "0.0.9";
  lock.files[HOOK] = hashOf(OLD);
  writeFileSync(join(dir, LOCK), JSON.stringify(lock, null, 2) + "\n");
  const r2 = updateRepo({ repoDir: dir, preset, version: "0.1.0" });
  assert.match(
    r2.events.find((x) => x.file === HOOK)?.detail || "",
    /installed copy is not on this machine/,
  );
});

test("the config gains the keys the template gained and keeps every value set here; the scripts absent are added", () => {
  const dir = tempRepo("update-config", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  delete cfg.provenance;
  delete cfg.ratchet;
  cfg.commands.gate = "npm run my-gate";
  cfg.maxStopBlocks = 9;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.scripts.standards;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const r = updateRepo({ repoDir: dir, preset });
  assert.match(r.events.find((e) => e.file === "abatty.config.json")?.detail || "", /provenance/);
  const after = JSON.parse(readFileSync(cfgPath, "utf8"));
  assert.equal(after.commands.gate, "npm run my-gate");
  assert.equal(after.maxStopBlocks, 9);
  assert.equal(after.provenance.trailer, "");
  assert.equal(JSON.parse(readFileSync(pkgPath, "utf8")).scripts.standards, "abatty ratchet");
  assert.deepEqual(
    addMissingKeys({ a: 1, b: { c: 2 } }, { a: 9, b: { c: 8, d: 3 }, e: 4, $comment: "x" }),
    ["b.d", "e"],
  );
});

test("a script removed after it was offered stays removed; a required one comes back", () => {
  const dir = tempRepo("update-declined", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  assert.ok(readLock(dir)?.scripts?.includes("lint"), "the lock lists the scripts offered");
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.scripts.lint;
  delete pkg.scripts.typecheck;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const r = updateRepo({ repoDir: dir, preset });
  const after = JSON.parse(readFileSync(pkgPath, "utf8")).scripts;
  assert.equal(after.lint, undefined, "a declined script is not written back");
  assert.ok(after.typecheck, "a script a required gate step runs is written back");
  assert.match(r.events.find((e) => e.file === "package.json")?.detail || "", /left out.*lint/);
});

test("a script the lock never offered is added, and a lock without the list reads as all offered", () => {
  const dir = tempRepo("update-offered", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const lock = readLock(dir);
  assert.ok(lock);
  lock.scripts = (lock.scripts || []).filter((s) => s !== "lint");
  writeFileSync(join(dir, LOCK), JSON.stringify(lock, null, 2) + "\n");
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.scripts.lint;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  updateRepo({ repoDir: dir, preset });
  assert.ok(
    JSON.parse(readFileSync(pkgPath, "utf8")).scripts.lint,
    "never offered, so offered now",
  );
  const legacy = readLock(dir);
  assert.ok(legacy);
  delete legacy.scripts;
  writeFileSync(join(dir, LOCK), JSON.stringify(legacy, null, 2) + "\n");
  const again = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete again.scripts.lint;
  writeFileSync(pkgPath, JSON.stringify(again, null, 2) + "\n");
  updateRepo({ repoDir: dir, preset });
  assert.equal(JSON.parse(readFileSync(pkgPath, "utf8")).scripts.lint, undefined);
});

test("mergeFile: clean when the edits are apart, conflicts counted when they meet", () => {
  const base = "a\nb\nc\n";
  assert.deepEqual(mergeFile("x\na\nb\nc\n", base, "a\nb\nc\nz\n"), {
    text: "x\na\nb\nc\nz\n",
    conflicts: 0,
  });
  assert.equal(mergeFile("a\nB\nc\n", base, "a\nbb\nc\n")?.conflicts, 1);
});

test("the CLI: update --dry-run writes nothing; --force takes the package's version; doctor names the installed version", () => {
  const dir = installedOld("update-cli");
  const dry = cli(["update", dir, "--dry-run"], dir);
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /updated\s+\.claude\/hooks\/session-brief\.mjs/);
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), OLD, "nothing written");
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(
    doc.out,
    /harness installed by abatty 0\.0\.9, the package is \d+\.\d+\.\d+ · abatty update/,
  );
  writeFileSync(join(dir, HOOK), "// mine\n");
  const forced = cli(["update", dir, "--force"], dir);
  assert.equal(forced.code, 0, forced.out);
  assert.match(forced.out, /overwritten\s+\.claude\/hooks\/session-brief\.mjs/);
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), NEW);
});

test("the version pin: init records the version in the config, update moves it, doctor says when the package differs", () => {
  const dir = tempRepo("update-pin", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const cfgPath = join(dir, "abatty.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  assert.match(cfg.abatty, /^\d+\.\d+\.\d+/);
  writeFileSync(cfgPath, JSON.stringify({ ...cfg, abatty: "0.0.9" }, null, 2) + "\n");
  const doc = cli(["doctor", dir, "--skip-self-test"], dir);
  assert.match(doc.out, /the config pins abatty 0\.0\.9, the package is \d+\.\d+\.\d+/);
  const up = cli(["update", dir], dir);
  assert.equal(up.code, 0, up.out);
  assert.equal(
    JSON.parse(readFileSync(cfgPath, "utf8")).abatty,
    cfg.abatty,
    "moved with the harness",
  );
  assert.match(up.out, /abatty\.config\.json.*abatty \d+\.\d+\.\d+/);
});

test("the lock records the copy that is installed, so a file init kept still takes the package's change", () => {
  const dir = tempRepo("update-kept", { "package.json": NEXT_PKG });
  // The repository already had its own hook when the instrument arrived: init keeps it, and the
  // lock must not claim the package's version was installed over it. Recording the package's
  // hash for every managed file was the bug - the file then read as "your edit; the package did
  // not change this file" for as long as the repository lived, and update never delivered a
  // change to it again.
  const own = "// this repository's own session brief\n";
  mkdirSync(dirname(join(dir, HOOK)), { recursive: true });
  writeFileSync(join(dir, HOOK), own);
  cli(["init", dir, "--stack", "next"], dir);
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), own, "init kept the repository's file");
  const lock = readLock(dir);
  assert.ok(lock);
  assert.notEqual(lock.files[HOOK], hashOf(NEW), "the lock does not claim the package's version");
  assert.equal(lock.files[HOOK], undefined, "a file never installed here has no ancestor");
  // With no ancestor to merge from, update writes the package's version beside it and touches
  // nothing: the repository's file is never silently replaced, and never silently frozen either.
  const r = updateRepo({ repoDir: dir, preset });
  const ev = r.events.find((e) => e.file === HOOK);
  assert.equal(ev?.action, "conflict", JSON.stringify(r.events.slice(0, 5)));
  assert.equal(readFileSync(join(dir, HOOK), "utf8"), own);
  assert.equal(readFileSync(join(dir, `${HOOK}.abatty-new`), "utf8"), NEW);
});

test("a file the package really installed keeps its ancestor across a re-run of init", () => {
  const dir = tempRepo("update-ancestor", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  const installed = readFileSync(join(dir, HOOK), "utf8");
  assert.equal(readLock(dir)?.files[HOOK], hashOf(installed));
  // The repository edits it, then runs init again: the ancestor stays the version that was
  // installed, so a later package change still merges against the right base.
  writeFileSync(join(dir, HOOK), installed + "\n// a local note\n");
  cli(["init", dir, "--stack", "next"], dir);
  const lock = readLock(dir);
  assert.equal(lock?.files[HOOK], hashOf(installed), "the ancestor is not moved to the edit");
  assert.equal(
    readFileSync(join(dir, BASE_DIR, lock.abatty, HOOK), "utf8"),
    installed,
    "and its copy is still on the machine to merge from",
  );
});
