/**
 * Types: strict TypeScript, or checkJs over a JavaScript repository; a typecheck script; no
 * escapes. Standard CODE.3. Which side applies is read from the sources: a repository with
 * more TypeScript than JavaScript is held to the strict flags, the other to checkJs.
 */

import { JS_SOURCES, SOURCES } from "../applies.mjs";
import { perPack } from "../../packs/rules.mjs";
import { codeOnly } from "../../ratchet/probes/lex.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "TYPES-CHECKJS",
    family: "Types",
    title: "A JavaScript repository typechecks over checkJs and ratchets the count",
    standard: ["CODE.3"],
    level: "must",
    enforcement: "ratchet",
    phase: "9",
    ...JS_SOURCES,
    why: "A JavaScript repository still has types, in the JSDoc and in the shapes it passes around; checkJs reads them and the count of errors is a number that may only fall.",
    next: "Add tsconfig with allowJs/checkJs and a typecheck script",
    check: (c) => {
      if (c.isTs)
        return { status: "n/a", evidence: "a TypeScript repository (TYPES-STRICT applies)" };
      const checkJs = /"checkJs"\s*:\s*true/.test(c.tsconfigText);
      const typecheck = c.script(/^type-?check$|tsc --noEmit/);
      return {
        status:
          c.jsSources.length === 0
            ? "n/a"
            : checkJs && typecheck
              ? "present"
              : checkJs
                ? "partial"
                : "missing",
        evidence: `${c.jsSources.length} js, ${c.tsSources.length} ts source file(s); ${checkJs ? "checkJs set" : "no tsconfig checkJs"}${typecheck ? "; `" + typecheck[0] + "`" : "; no typecheck script"}`,
      };
    },
  },
  {
    id: "TYPES-STRICT",
    family: "Types",
    title: "strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes",
    standard: ["CODE.3"],
    level: "must",
    enforcement: "hard",
    phase: "9",
    ...JS_SOURCES,
    why: "strict alone lets an index read return undefined unnoticed and an optional property be set to undefined; the two extra flags close the holes the runtime finds first.",
    next: "Enable the missing flags; migrate in the order strictNullChecks, noImplicitAny, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes",
    check: (c) => {
      if (!c.isTs)
        return { status: "n/a", evidence: "a JavaScript repository (TYPES-CHECKJS applies)" };
      const strict = /"strict"\s*:\s*true/.test(c.tsconfigText);
      const nuia = /"noUncheckedIndexedAccess"\s*:\s*true/.test(c.tsconfigText);
      const eopt = /"exactOptionalPropertyTypes"\s*:\s*true/.test(c.tsconfigText);
      return {
        status: strict && nuia && eopt ? "present" : strict ? "partial" : "missing",
        evidence: `strict=${strict}, noUncheckedIndexedAccess=${nuia}, exactOptionalPropertyTypes=${eopt}`,
      };
    },
  },
  {
    id: "TYPES-SCRIPT",
    family: "Types",
    title: "A typecheck script runs the compiler without emitting, for every language in the tree",
    standard: ["CODE.3"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...SOURCES,
    why: "The build may skip the type errors a bundler tolerates; tsc --noEmit is the one command that reads them all, and the gate needs its name.",
    next: "Add typecheck: tsc --noEmit and put it in the gate",
    check: (c) => {
      const others = perPack(c, "typecheck", (p) => p.id !== "javascript");
      if (!c.isTs) {
        if (others.status !== "n/a") return others;
        return { status: "n/a", evidence: "a JavaScript repository (TYPES-CHECKJS applies)" };
      }
      const s = c.script(/^type-?check$|tsc --noEmit/);
      const js = s ? "present" : "missing";
      return {
        status:
          others.status === "n/a"
            ? js
            : js === "present" && others.status === "present"
              ? "present"
              : js === "missing" && others.status === "missing"
                ? "missing"
                : "partial",
        evidence: `${s?.[0] ? "typescript: `" + s[0] + "`" : "typescript: none"}${others.status === "n/a" ? "" : "; " + others.evidence}`,
      };
    },
  },
  {
    id: "TYPES-ESCAPES",
    family: "Types",
    title: "any and @ts-ignore absent from source",
    standard: ["CODE.3"],
    level: "must",
    enforcement: "ratchet",
    phase: "1 / 9",
    ...JS_SOURCES,
    why: "Every any is a place the compiler was told to look away; the count is the honest measure of how strict the types are.",
    next: "Ban any with no-explicit-any; ratchet the count with types.escapes, which counts code and not what a message or a string quotes",
    check: (c) => {
      if (!c.isTs)
        return { status: "n/a", evidence: "a JavaScript repository (TYPES-CHECKJS applies)" };
      const typed = c.sourceFiles.filter((f) => !/\.d\.ts$/.test(f));
      // Strings blanked and comments kept, as types.escapes reads them: an escape quoted in a
      // message is text, and a directive lives in a comment.
      const code = (/** @type {string} */ f) => codeOnly(c.read(f), { comments: "keep" });
      const anyCount = typed.reduce(
        (n, f) => n + (code(f).match(/:\s*any\b|as any\b/g) || []).length,
        0,
      );
      const tsIgnore = typed.reduce((n, f) => n + (code(f).match(/@ts-ignore/g) || []).length, 0);
      return {
        status:
          anyCount + tsIgnore === 0 ? "present" : anyCount + tsIgnore < 20 ? "partial" : "missing",
        evidence: `${anyCount} any, ${tsIgnore} @ts-ignore`,
      };
    },
  },
];
