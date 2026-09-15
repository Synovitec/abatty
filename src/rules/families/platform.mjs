/**
 * i18n, a11y and PWA: the catalogues and their completeness, hardcoded text as a lint error,
 * the a11y plugin with its component mapping, contrast from the tokens, the service worker
 * under a contract test. Standard I18N.1, A11Y.1, PWA.1. Each applies where the stack has the
 * surface (a browser application, catalogues, a service worker) and is n/a elsewhere.
 */

const LOCALES =
  /(^|\/)(locales|messages|i18n)\/[^/]+\/.*\.json$|(^|\/)(locales|messages|i18n)\/[a-z]{2}(-[A-Z]{2})?\.json$|(^|\/)i18n\/(dict|messages|catalog|translations)\.(ts|js)$/;

import { BROWSER, PWA, TEXT } from "../applies.mjs";

/** @type {import("../index.mjs").Rule[]} */
export const rules = [
  {
    id: "I18N-CATALOGUE",
    family: "i18n",
    title: "Translation catalogues exist",
    standard: ["I18N.1"],
    level: "should",
    enforcement: "prose",
    phase: "-",
    ...TEXT,
    why: "Copy in a catalogue can be translated, reviewed and checked for completeness; copy in the components can only be found by reading them.",
    next: "-",
    check: (c) => {
      const locales = c.files(LOCALES);
      const dirs = new Set(
        locales.map((f) => (f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ".")),
      );
      return {
        status: locales.length > 0 ? "present" : "missing",
        evidence: locales.length
          ? `${locales.length} file(s) in ${dirs.size} folder(s)`
          : "no catalogue found",
      };
    },
  },
  {
    id: "I18N-LINT",
    family: "i18n",
    title: "Hardcoded component text is a lint error",
    standard: ["I18N.1"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...TEXT,
    why: "One string typed into a component is one string the translators never see; the linter refuses it at the line.",
    next: "Add react/jsx-no-literals or eslint-plugin-i18next at error",
    check: (c) => {
      const rule = /jsx-no-literals|no-literal-string/.test(c.eslintText);
      return {
        status: rule ? "present" : "missing",
        evidence: rule ? "rule present" : "none",
      };
    },
  },
  {
    id: "I18N-PARITY",
    family: "i18n",
    title: "Locale completeness checked (every key in every locale)",
    standard: ["I18N.1"],
    level: "must",
    enforcement: "hard",
    phase: "1",
    ...TEXT,
    why: "A key missing in one locale is a raw identifier on a customer's screen; a test over the set refuses the commit that forgot one.",
    next: "Add a completeness test and the pre-commit locale-set check",
    check: (c) => {
      const parity =
        c.files(/(messages|dict|locale|i18n).*\.test\.(ts|js|mjs)$/).length > 0 ||
        /i18n|locale/.test(c.read(c.firstFile(/pre-commit/) || ""));
      return {
        status: parity ? "present" : c.files(LOCALES).length ? "missing" : "n/a",
        evidence: parity ? "a test or hook checks the set" : "none",
      };
    },
  },
  {
    id: "A11Y-LINT",
    family: "a11y",
    title:
      "eslint-plugin-jsx-a11y at error, with component mapping when a component library is used",
    standard: ["A11Y.1"],
    level: "must",
    enforcement: "hard",
    phase: "3",
    ...BROWSER,
    why: "The countable part of WCAG (a label, an alt, a role) is refused by the linter at the line; a component library needs the mapping or the plugin sees nothing.",
    next: "Add the plugin at error and map the component library (settings + polymorphicPropName)",
    check: (c) => {
      const plugin = /jsx-a11y/.test(c.eslintText);
      const mapped = /polymorphicPropName/.test(c.eslintText);
      const lib = c.has("@mui/material") || [...c.deps].some((d) => d.startsWith("@radix-ui/"));
      const jsx = c.sourceFiles.some((f) => /\.(tsx|jsx)$/.test(f));
      return {
        status:
          plugin && (!lib || mapped) ? "present" : plugin ? "partial" : jsx ? "missing" : "n/a",
        evidence: `${plugin ? "plugin" : "no plugin"}${mapped ? " + polymorphicPropName" : lib ? " (component library present, no mapping)" : ""}`,
      };
    },
  },
  {
    id: "A11Y-CONTRAST",
    family: "a11y",
    title: "Contrast computed from the token file by a script",
    standard: ["A11Y.1"],
    level: "should",
    enforcement: "hard",
    phase: "3",
    ...BROWSER,
    why: "Contrast is arithmetic over the tokens, both themes; a script computes what a reviewer estimates.",
    next: "Add a contrast script over the token file, both themes",
    check: (c) => {
      const s = c.script(/contrast/);
      return { status: s ? "present" : "missing", evidence: s?.[0] || "none" };
    },
  },
  {
    id: "PWA-CONTRACT",
    family: "PWA",
    title: "Service worker under a contract test; assets resolve",
    standard: ["PWA.1"],
    level: "must",
    enforcement: "hard",
    phase: "-",
    ...PWA,
    why: "A service worker that serves a stale shell serves it to every user until they clear the site; the contract test is the one thing that catches it before them.",
    next: "Add the never-stale-shell contract test and the broken-asset metric",
    check: (c) => {
      const sw = c.firstFile(/(^|\/)(sw|service-worker)\.(js|ts)$/);
      const manifest = c.firstFile(
        /(^|\/)manifest\.(json|webmanifest|ts)$|manifest\.webmanifest\/route\.ts$/,
      );
      const test = c.files(/service-?worker.*\.test\.|sw\.test\.|pwa.*\.test\./).length > 0;
      return {
        status: !sw && !manifest ? "n/a" : test ? "present" : "partial",
        evidence: `${sw || "no worker"}, ${manifest || "no manifest"}${test ? ", contract test" : ", no contract test"}`,
      };
    },
  },
];
