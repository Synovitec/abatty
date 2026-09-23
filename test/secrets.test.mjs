import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, git, tempRepo } from "./helpers.mjs";
import { scanSecrets, scanText } from "../src/core/secrets.mjs";
import { auditOutcome } from "../src/core/audit.mjs";
import { CORPUS, NEGATIVES, POSITIVES, scoreCorpus } from "../src/core/secret-corpus.mjs";
import { runGate } from "../src/core/gate.mjs";
import { presetById } from "../src/presets/index.mjs";

// The samples are built at runtime so this file plants nothing a scanner would find at rest.
const KEY_ID = "AKIA" + "IOSFODNN7EXAMPLE".replace("EXAMPLE", "QWERTYU");
const PEM = ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ");
const TOKEN = "ghp_" + "a".repeat(20) + "b".repeat(20);
const ASSIGN = 'const apiKey = "' + "Zx9".repeat(8) + '";';

test("the shapes: a private key block, an access key id, a provider token, a payment key, a chat token, a signed web token, a long literal on a secret-like name; placeholders and marked lines are not findings", () => {
  const found = scanText(
    "x.ts",
    [
      PEM,
      KEY_ID,
      TOKEN,
      "sk_live_" + "Q".repeat(24),
      "xoxb-" + "1".repeat(12) + "-" + "a".repeat(12),
      "eyJ" + "a".repeat(12) + ".eyJ" + "b".repeat(12) + "." + "c".repeat(12),
      ASSIGN,
    ].join("\n"),
  );
  assert.deepEqual(
    found.map((f) => f.kind),
    [
      "private key block",
      "cloud access key id",
      "hosting provider token",
      "payment key",
      "chat token",
      "signed web token",
      "a long literal assigned to a secret-like name",
    ],
  );
  assert.equal(found[0]?.line, 1);
  assert.ok(
    found.every((f) => f.sample.includes("…")),
    "the sample never shows the whole value",
  );
  assert.deepEqual(
    scanText(
      "y.ts",
      [
        'const password = "xxxxxxxxxxxxxxxxxxxx";',
        'apiKey: "<your-api-key-goes-here>"',
        'token = "${SECRET_FROM_ENV}"',
        'secret_key = "changeme_changeme_1"',
        ASSIGN + " // abatty:allow-secret",
      ].join("\n"),
    ),
    [],
  );
});

test("scanSecrets over the tree, the staged files and a range; the allow list by path; lockfiles and binaries skipped", () => {
  const dir = tempRepo("secrets-tree", {
    "package.json": NEXT_PKG,
    "src/clean.ts": "export const a = 1;\n",
    "src/leak.ts": `export const k = "${KEY_ID}";\n`,
    "fixtures/sample.ts": `export const k = "${KEY_ID}";\n`,
    "package-lock.json": `{"x":"${KEY_ID}"}\n`,
  });
  const tree = scanSecrets(dir, { mode: "tree" });
  assert.deepEqual(tree.findings.map((f) => f.path).sort(), ["fixtures/sample.ts", "src/leak.ts"]);
  assert.deepEqual(
    scanSecrets(dir, { mode: "tree", allow: ["fixtures/"] }).findings.map((f) => f.path),
    ["src/leak.ts"],
  );
  writeFileSync(
    join(dir, "abatty.config.json"),
    JSON.stringify({ secrets: { allow: ["fixtures/"] } }),
  );
  assert.deepEqual(
    scanSecrets(dir, { mode: "tree" }).findings.map((f) => f.path),
    ["src/leak.ts"],
    "the config's allow list",
  );
  writeFileSync(join(dir, "src/new.ts"), `export const t = "${TOKEN}";\n`);
  assert.equal(scanSecrets(dir, { mode: "staged" }).findings.length, 0, "not staged yet");
  git(dir, "add", "src/new.ts");
  assert.deepEqual(
    scanSecrets(dir, { mode: "staged" }).findings.map((f) => f.path),
    ["src/new.ts"],
  );
  git(dir, "commit", "-q", "-m", "feat: new");
  assert.deepEqual(
    scanSecrets(dir, { mode: "HEAD~1..HEAD" }).findings.map((f) => f.path),
    ["src/new.ts"],
    "the range's files only",
  );
});

test("the gate: the secret scan is a built-in step that stops the gate on a finding; the audit cannot run without a lockfile", () => {
  const dir = tempRepo("secrets-gate", {
    "package.json": JSON.stringify({
      name: "g",
      version: "0.1.0",
      scripts: {
        test: 'node -e "process.exit(0)"',
        typecheck: 'node -e "process.exit(0)"',
        standards: 'node -e "process.exit(0)"',
      },
      dependencies: { next: "15" },
    }),
    "src/leak.ts": `export const k = "${KEY_ID}";\n`,
  });
  const preset = presetById("next");
  assert.ok(preset);
  /** @type {string[]} */
  const log = [];
  const r = runGate({ repoDir: dir, preset, fast: true, log: (l) => log.push(l), run: () => 0 });
  assert.equal(r.ok, false);
  const scan = r.events.find((e) => /secret scan/.test(e.label));
  assert.equal(scan?.outcome, "failed", JSON.stringify(r.events));
  assert.match(log.join("\n"), /src\/leak\.ts:1 {2}cloud access key id/);
  writeFileSync(join(dir, "src/leak.ts"), "export const k = 1;\n");
  const green = runGate({ repoDir: dir, preset, fast: true, log: () => {}, run: () => 0 });
  assert.equal(green.events.find((e) => /secret scan/.test(e.label))?.outcome, "ok");
  // No lockfile is no instrument: the audit step is errored and the gate stops on it, where it
  // once read "skipped" and the gate passed.
  assert.equal(green.events.find((e) => /audit/.test(e.label))?.outcome, "errored", "no lockfile");
  assert.equal(green.ok, false);
  assert.equal(auditOutcome(dir, () => ({ status: 1, output: "x" })).outcome, "errored");
  writeFileSync(join(dir, "package-lock.json"), "{}\n");
  assert.equal(
    auditOutcome(dir, () => ({
      status: 1,
      output: "request to https://registry failed, reason: getaddrinfo ENOTFOUND",
    })).outcome,
    "deferred",
  );
  assert.equal(
    auditOutcome(dir, () => ({ status: 1, output: "found 2 high severity vulnerabilities" }))
      .outcome,
    "failed",
  );
  assert.equal(auditOutcome(dir, () => ({ status: 0, output: "" })).outcome, "ok");
});

test("the CLI and the hook: abatty secrets --staged is what init's pre-commit hook runs, one implementation with the gate and CI", () => {
  const dir = tempRepo("secrets-cli", { "package.json": NEXT_PKG });
  cli(["init", dir, "--stack", "next"], dir);
  assert.match(readFileSync(join(dir, ".githooks/pre-commit"), "utf8"), /abatty secrets --staged/);
  const clean = cli(["secrets", dir], dir);
  assert.equal(clean.code, 0, clean.out);
  writeFileSync(join(dir, "leak.ts"), `${PEM}\n`);
  const tree = cli(["secrets", dir], dir);
  assert.equal(tree.code, 3);
  assert.match(tree.out, /private key block/);
  assert.equal(
    cli(["secrets", dir, "--staged"], dir).code,
    0,
    "unstaged: the hook would let the commit through, the gate would not",
  );
  git(dir, "add", "leak.ts");
  const staged = cli(["secrets", dir, "--staged", "--json"], dir);
  assert.equal(staged.code, 3);
  assert.equal(JSON.parse(staged.out).findings[0].path, "leak.ts");
});

test("the secret scan is measured against the published corpus, and the numbers are a floor", () => {
  const r = scoreCorpus((text, path) => scanText(path, text));

  // A corpus that only contains what the scanner already catches measures nothing, so the shape
  // of the corpus is checked before its score: look-alikes outnumber secrets, and every case
  // says in words why it is the verdict it is.
  assert.ok(POSITIVES.length >= 15, `${POSITIVES.length} secrets in the corpus`);
  assert.ok(NEGATIVES.length >= POSITIVES.length, "the look-alikes are the harder half");
  for (const c of CORPUS) assert.ok(c.why.length > 20, `a case with no reason: ${c.text}`);

  // The floor, published in docs/SECRET_SCAN_BENCHMARK.md. These may rise and never fall.
  assert.equal(r.precision, 100, r.falsePositives.map((x) => x.why).join("; "));
  assert.equal(r.recall, 100, r.falseNegatives.map((x) => x.why).join("; "));

  // and the mutation in both directions: the corpus can tell a working scanner from a broken one
  assert.equal(scoreCorpus(() => []).recall, 0, "a scanner that finds nothing scores zero recall");
  const everything = scoreCorpus(() => [{}]);
  assert.equal(everything.recall, 100);
  assert.ok(everything.precision < 50, "a scanner that reports everything loses on precision");
});

test("the throwaway credential every pipeline writes is not a finding, and a real one still is", () => {
  const throwaway = "DATABASE_URL: postgres://postgres:postgres@postgres:5432/test";
  assert.deepEqual(scanText("ci.yml", throwaway), []);
  assert.deepEqual(scanText("ci.yml", "redis://root:root@cache:6379/0"), []);
  const real = scanText("env", "DATABASE_URL=postgres://app:hunter2hunter2@db.internal:5432/app");
  assert.equal(real.length, 1);
  assert.equal(real[0]?.kind, "a connection string carrying a password");
});
