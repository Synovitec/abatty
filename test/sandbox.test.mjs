import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectDriver,
  judgeProbe,
  prepareSandbox,
  sandboxConfig,
  sandboxPlan,
} from "../src/night/sandbox.mjs";
import { buildSandbox, seatbeltProfile } from "../src/night/sandbox-drivers.mjs";

const posix = process.platform !== "win32";

/** A repository shape on disk: the harness folder, its night folder, the root config, one protected folder. @param {string} name */
function shape(name) {
  const dir = mkdtempSync(join(tmpdir(), `abatty-sandbox-${name}-`));
  mkdirSync(join(dir, ".claude", "night", "2026-09-15"), { recursive: true });
  mkdirSync(join(dir, "migrations"), { recursive: true });
  writeFileSync(join(dir, "abatty.config.json"), "{}\n");
  return dir;
}

test("the config block, normalised: modes and drivers validated, an image selects the container driver", () => {
  assert.equal(sandboxConfig({}).mode, "auto");
  assert.equal(sandboxConfig({ sandbox: { mode: "required" } }).mode, "required");
  assert.equal(
    sandboxConfig({ sandbox: { mode: "required" } }, "off").mode,
    "off",
    "the flag wins",
  );
  assert.equal(sandboxConfig({ sandbox: { image: "img" } }).driver, "container");
  assert.throws(() => sandboxConfig({ sandbox: { mode: "maybe" } }), /sandbox\.mode is one of/);
  assert.throws(() => sandboxConfig({ sandbox: { driver: "jail" } }), /sandbox\.driver is one of/);
  assert.equal(
    detectDriver(sandboxConfig({}), () => false),
    "",
    "no driver found",
  );
  assert.equal(
    detectDriver(sandboxConfig({ sandbox: { driver: "bwrap" } }), () => false),
    "bwrap",
  );
  assert.equal(
    detectDriver(sandboxConfig({ sandbox: { image: "img" } }), (b) => b === "podman"),
    "container",
  );
});

test("the plan: the harness, the root config and the existing protected paths read-only; the hooks' log writable; a prefix that is not a path skipped", () => {
  const dir = shape("plan");
  const plan = sandboxPlan(sandboxConfig({ sandbox: { readOnly: ["migrations"] } }), {
    repoDir: dir,
    folder: ".claude",
    protectedPaths: ["migrations/", ".env.", "prod.dont.touch"],
    nightDir: join(dir, ".claude/night/2026-09-15"),
  });
  assert.deepEqual(plan.readOnly, [
    join(dir, ".claude"),
    join(dir, "abatty.config.json"),
    join(dir, "migrations"),
  ]);
  assert.equal(plan.logDir, join(dir, ".claude", "night"));
  assert.ok(plan.writable.includes(plan.logDir), "the hooks' log folder is writable");
  assert.ok(!plan.writable.some((p) => p.includes(".env")), "a prefix is not a mount");
});

test("the drivers' argv: bubblewrap binds in order, the Seatbelt rules in order, the container's mounts and variables", () => {
  const dir = shape("argv");
  const plan = sandboxPlan(sandboxConfig({ sandbox: { env: ["TOKEN"] } }), {
    repoDir: dir,
    folder: ".claude",
    protectedPaths: [],
    nightDir: join(dir, ".claude/night/2026-09-15"),
  });
  const bw = buildSandbox("bwrap", plan).wrap("agent", ["-p", "hi"]);
  assert.equal(bw.cmd, "bwrap");
  const a = bw.args;
  /** @param {string} flag @param {string} p */
  const at = (flag, p) => a.findIndex((x, i) => x === flag && a[i + 1] === p);
  assert.ok(at("--ro-bind", "/") === 0, "the machine read-only first");
  assert.ok(at("--bind", dir) < at("--ro-bind", join(dir, ".claude")), "the harness over the tree");
  assert.ok(
    at("--ro-bind", join(dir, ".claude")) < at("--bind", join(dir, ".claude", "night")),
    "the log folder over the harness",
  );
  assert.deepEqual(a.slice(-4), ["--", "agent", "-p", "hi"]);
  assert.ok(!a.includes("--tmpfs"), "the temp folder is the host's");

  const profile = seatbeltProfile(plan);
  // A Seatbelt string escapes its backslashes; a Windows temp folder has some.
  const sb = (/** @type {string} */ p) => `(subpath "${p.replace(/["\\]/g, "\\$&")}")`;
  const order = [
    "(deny file-write*)",
    sb(dir),
    sb(join(dir, ".claude")),
    sb(join(dir, ".claude", "night")),
  ];
  let last = -1;
  for (const s of order) {
    const i = profile.indexOf(s);
    assert.ok(i > last, `${s} in order`);
    last = i;
  }

  const ct = buildSandbox("container", { ...plan, image: "img:1", command: "podman" }).wrap(
    "agent",
    ["-p"],
    ["ADOPTION_RUN"],
  );
  assert.equal(ct.cmd, "podman");
  // The same path inside, except under the home, which is the container's: a temp folder that
  // lives under the home (Windows) is remapped, one that does not (Linux) is mounted as is.
  const inside = (/** @type {string} */ p) =>
    p.startsWith(homedir()) ? "/root" + p.slice(homedir().length) : p;
  assert.ok(ct.args.includes(`${join(dir, ".claude")}:${inside(join(dir, ".claude"))}:ro`));
  assert.ok(ct.args.includes("TOKEN") && ct.args.includes("ADOPTION_RUN"), "variables by name");
  assert.deepEqual(ct.args.slice(-3), ["img:1", "agent", "-p"]);
  assert.throws(() => buildSandbox("container", plan), /needs sandbox\.image/);
  assert.throws(() => buildSandbox("jail", plan), /unknown sandbox driver/);
});

test("the probe's verdict names every hole and every missing permission", () => {
  assert.deepEqual(
    judgeProbe(
      {
        tree: "ok",
        night: "ok",
        outside: "denied:EROFS",
        readOnly: { "/r/.claude": "denied:EROFS" },
      },
      "/usr/bin",
    ),
    [],
  );
  const f = judgeProbe(
    {
      tree: "denied:EROFS",
      night: "denied:EROFS",
      outside: "ok",
      readOnly: { "/r/.claude": "ok", "/r/abatty.config.json": "denied:EROFS" },
    },
    "/usr/bin",
  );
  assert.equal(f.length, 4, f.join("\n"));
  assert.match(f.join("\n"), /working tree is not writable/);
  assert.match(f.join("\n"), /hooks' log folder/);
  assert.match(f.join("\n"), /\/usr\/bin is writable/);
  assert.match(f.join("\n"), /\/r\/\.claude is writable/);
});

test("prepare: off is the guard alone; required without a driver is no night; a driver that does not start is no night", () => {
  const dir = shape("prepare");
  const c = { repoDir: dir, folder: ".claude", nightDir: join(dir, ".claude/night/2026-09-15") };
  const off = prepareSandbox({ sandbox: { mode: "off" } }, c);
  assert.equal(off.driver, "none");
  assert.equal(off.sandbox, null);
  assert.match(off.note, /the guard is the only layer/);
  assert.equal(
    prepareSandbox({}, { ...c, mode: "maybe" }).refuse,
    'sandbox.mode is one of auto, required, off, not "maybe"',
  );

  const path = process.env.PATH;
  process.env.PATH = mkdtempSync(join(tmpdir(), "abatty-empty-path-"));
  try {
    const none = prepareSandbox({ sandbox: { mode: "required" } }, c);
    assert.match(none.refuse, /no sandbox driver on this machine.*sandbox\.mode is required/);
    const auto = prepareSandbox({}, c);
    assert.equal(auto.refuse, "");
    assert.match(auto.note, /no sandbox driver.*the guard is the only layer/);
  } finally {
    process.env.PATH = path;
  }
  const dead = prepareSandbox(
    { sandbox: { driver: "bwrap", command: join(dir, "no-such-bwrap") } },
    c,
  );
  assert.match(dead.refuse, /could not start/);
});

test(
  "a sandbox that is present but does not hold refuses the night, naming the hole",
  { skip: !posix },
  () => {
    const dir = shape("fake");
    // A "bwrap" that ignores every flag and runs the command: the harness stays writable inside.
    const fake = join(dir, "fake-bwrap");
    writeFileSync(
      fake,
      `#!/usr/bin/env node\nconst i = process.argv.indexOf("--");\nconst [c, ...a] = process.argv.slice(i + 1);\nconst r = require("node:child_process").spawnSync(c, a, { stdio: "inherit" });\nprocess.exit(r.status ?? 1);\n`,
    );
    chmodSync(fake, 0o755);
    const r = prepareSandbox(
      { sandbox: { driver: "bwrap", command: fake } },
      { repoDir: dir, folder: ".claude", nightDir: join(dir, ".claude/night/2026-09-15") },
    );
    assert.equal(r.sandbox, null);
    assert.match(r.refuse, /does not hold/);
    assert.match(
      r.refuse,
      new RegExp(`${join(dir, ".claude").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is writable`),
    );
    assert.match(r.refuse, /abatty\.config\.json is writable/);
  },
);
