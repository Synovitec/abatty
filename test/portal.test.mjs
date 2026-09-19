import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_PKG, cli, tempRepo } from "./helpers.mjs";
import { ANNOTATION_PREFIX, mergePortalEntity, portalFacts } from "../src/ui/portal.mjs";

const reading = { name: "shop", score: 74, phase: "0", applicable: 54, date: "2026-09-19" };

test("a reading with no dashboard claims no URL, because an annotation pointing nowhere renders as a link", () => {
  const local = portalFacts(reading);
  assert.deepEqual(local.links, []);
  assert.deepEqual(Object.keys(local.annotations).sort(), [
    "abatty.dev/checks",
    "abatty.dev/measured-at",
    "abatty.dev/phase",
    "abatty.dev/score",
  ]);
  const hosted = portalFacts({ ...reading, dashboard: "https://d.example/" });
  assert.equal(hosted.annotations["abatty.dev/report"], "https://d.example/api/reports/shop");
  assert.equal(hosted.annotations["abatty.dev/events"], "https://d.example/api/events/shop");
  assert.equal(hosted.links.length, 1);
});

test("a new descriptor is written whole, and it refuses to guess an owner", () => {
  const r = mergePortalEntity(null, { name: "shop", description: "d" }, portalFacts(reading));
  assert.equal(r.created, true);
  assert.match(r.text, /kind: Component/);
  assert.match(r.text, /abatty\.dev\/score: "74"/);
  assert.match(r.text, /owner: unknown # fill this in/);
});

test("an existing descriptor keeps everything that is not this package's, including its comments", () => {
  const existing = [
    "# our own file, with a comment we care about",
    "apiVersion: backstage.io/v1alpha1",
    "kind: Component",
    "metadata:",
    "  name: shop",
    "  annotations:",
    "    backstage.io/techdocs-ref: dir:.",
    '    abatty.dev/score: "12"',
    "spec:",
    "  owner: team-payments",
    "  lifecycle: experimental",
    "",
  ].join("\n");
  const r = mergePortalEntity(existing, { name: "shop", description: "d" }, portalFacts(reading));
  assert.equal(r.created, false);
  assert.deepEqual(r.replaced, ["abatty.dev/score"], "the stale one is rewritten in place");
  assert.ok(r.added.includes("abatty.dev/checks"));
  // everything that is not ours survives, byte for byte
  assert.match(r.text, /# our own file, with a comment we care about/);
  assert.match(r.text, /backstage\.io\/techdocs-ref: dir:\./);
  assert.match(r.text, /owner: team-payments/);
  assert.match(r.text, /lifecycle: experimental/);
  assert.match(r.text, /abatty\.dev\/score: "74"/);
  assert.equal(/abatty\.dev\/score: "12"/.test(r.text), false);
  assert.equal(
    (r.text.match(new RegExp(ANNOTATION_PREFIX.replace("/", "\\/") + "score", "g")) || []).length,
    1,
    "rewritten, never duplicated",
  );
});

test("a descriptor with no annotations block gains one under metadata, and one with no metadata is left alone", () => {
  const noAnnotations = "kind: Component\nmetadata:\n  name: shop\nspec:\n  owner: t\n";
  const a = mergePortalEntity(
    noAnnotations,
    { name: "shop", description: "d" },
    portalFacts(reading),
  );
  assert.match(a.text, /metadata:\n {2}annotations:\n {4}abatty\.dev\/score/);
  assert.match(a.text, /owner: t/);

  const noMetadata = "kind: Component\nspec:\n  owner: t\n";
  const b = mergePortalEntity(noMetadata, { name: "shop", description: "d" }, portalFacts(reading));
  assert.equal(b.text, noMetadata, "a shape it does not understand is not a shape it edits");
  assert.deepEqual(b.added, []);
});

test("the command writes the file, merges on a second run, and says what it touched", () => {
  const dir = tempRepo("portal", {
    "package.json": NEXT_PKG,
    "src/index.ts": "export const x = 1;\n",
  });
  const first = cli(["portal", dir], dir);
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /written: catalog-info\.yaml/);
  assert.match(first.out, /fill in the owner/);

  writeFileSync(
    join(dir, "catalog-info.yaml"),
    readFileSync(join(dir, "catalog-info.yaml"), "utf8").replace("owner: unknown", "owner: team-x"),
  );
  const second = cli(["portal", dir], dir);
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, /merged: catalog-info\.yaml/);
  assert.match(second.out, /the rest of the file is untouched/);
  assert.match(readFileSync(join(dir, "catalog-info.yaml"), "utf8"), /owner: team-x/);
});
