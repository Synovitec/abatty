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
