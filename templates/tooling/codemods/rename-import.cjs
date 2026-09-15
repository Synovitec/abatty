/**
 * A codemod skeleton (CODE.11): the same change in more than ten files is written once, here,
 * and applied by jscodeshift - never hand-edited file by file. Copy to
 * `scripts/codemods/<what-it-does>.cjs` and name it after the change, not the tool.
 *
 * This one moves an import from one module to another and renames the imported symbol:
 *   `import { readEnv } from "../config"`  ->  `import { env } from "@/lib/env"`
 * and rewrites `readEnv("X")` call sites to `env.X`. Replace the three constants and the
 * transform; keep the shape (parser, dry run, count).
 *
 * Dry run (prints what would change, touches nothing; the count goes in the commit message):
 *   npx jscodeshift --parser=tsx --dry --print -t scripts/codemods/rename-import.cjs src
 * Apply, then format, then one commit that touches nothing else:
 *   npx jscodeshift --parser=tsx -t scripts/codemods/rename-import.cjs src && npx prettier --write src
 *
 * The reviewer reads this file and samples its output; behaviour is preserved by construction
 * (an AST transform cannot mistype a string), which is what a night cannot promise by hand.
 */
const FROM_MODULE = /(^|\/)config$/;
const TO_MODULE = "@/lib/env";
const RENAME = { readEnv: "env" };

/** @type {import('jscodeshift').Transform} */
module.exports = function transform(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let touched = 0;

  root
    .find(j.ImportDeclaration)
    .filter((p) => FROM_MODULE.test(String(p.node.source.value)))
    .forEach((p) => {
      const specifiers = p.node.specifiers || [];
      const renamed = specifiers.filter((s) => s.type === "ImportSpecifier" && RENAME[s.imported.name]);
      if (renamed.length === 0) return;
      // The renamed symbols move to the new module; whatever else the line imported stays.
      p.node.specifiers = specifiers.filter((s) => !renamed.includes(s));
      const newSpecifiers = renamed.map((s) => j.importSpecifier(j.identifier(RENAME[s.imported.name])));
      p.insertAfter(j.importDeclaration(newSpecifiers, j.literal(TO_MODULE)));
      if (p.node.specifiers.length === 0) p.prune();
      touched++;
    });

  // readEnv("NAME") -> env.NAME
  root
    .find(j.CallExpression, { callee: { type: "Identifier", name: "readEnv" } })
    .forEach((p) => {
      const [arg] = p.node.arguments;
      if (!arg || arg.type !== "StringLiteral" && arg.type !== "Literal") return;
      p.replace(j.memberExpression(j.identifier("env"), j.identifier(String(arg.value))));
      touched++;
    });

  // Returning null tells jscodeshift the file is unchanged, so the dry-run count is exact.
  return touched ? root.toSource({ quote: "double" }) : null;
};

module.exports.parser = "tsx";
