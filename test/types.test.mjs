import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

/** @param {string} dir @param {string} [base] @param {string[]} [acc] */
function listFiles(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, base, acc);
    else acc.push(relative(base, p).split("\\").join("/"));
  }
  return acc.sort();
}

test("types/ is the declarations generated from the JSDoc: npm run types, committed, equal to a fresh emit", () => {
  const out = mkdtempSync(join(tmpdir(), "abatty-types-"));
  const r = spawnSync("npx", ["tsc", "-p", "tsconfig.types.json", "--outDir", out], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const fresh = listFiles(out);
  const committed = listFiles(join(ROOT, "types"));
  assert.deepEqual(committed, fresh, "the same files (run npm run types and commit)");
  for (const f of fresh)
    assert.equal(
      readFileSync(join(ROOT, "types", f), "utf8"),
      readFileSync(join(out, f), "utf8"),
      `${f} differs from a fresh emit: run npm run types and commit`,
    );
  assert.ok(fresh.length > 40);
});

test("every export of the package has its declaration, and the package names them", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.types, "./types/src/index.d.mts");
  assert.ok(existsSync(join(ROOT, pkg.types)));
  for (const [k, v] of Object.entries(pkg.exports)) {
    assert.equal(typeof v, "object", `${k}: types and default conditions`);
    assert.ok(
      existsSync(join(ROOT, /** @type {any} */ (v).types)),
      `${k}: ${/** @type {any} */ (v).types}`,
    );
    assert.ok(
      existsSync(join(ROOT, /** @type {any} */ (v).default)),
      `${k}: ${/** @type {any} */ (v).default}`,
    );
  }
  assert.ok(pkg.files.includes("types"), "shipped");
  const index = readFileSync(join(ROOT, "types/src/index.d.mts"), "utf8");
  assert.match(index, /export \{ runGate \} from "\.\/core\/gate\.mjs";/);
  assert.match(
    index,
    /export \{ pushRange, pushRangeInfo, pendingPaths \} from "\.\/core\/range\.mjs";/,
  );
});
