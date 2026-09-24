/**
 * The pages no browser test opens (standard TEST.3). An adopter's every metric was green, the
 * library's coverage near ninety-nine, while two forms on one screen saved nothing in production:
 * the screen was outside every floor, and nothing measured which pages the browser suite drives.
 * This reads the page routes a web framework declares by file (Next's `app/` and `pages/`) and
 * the paths the browser suite names, and counts each route none of them opens. Opt-in, like
 * every probe that reads one stack.
 */
import { codeOnly } from "./lex.mjs";

/** A page of the app router, or of the pages router outside its API and special files. */
const APP_PAGE = /(^|\/)app\/(.*\/)?page\.[cm]?[jt]sx?$/;
const PAGES_PAGE = /(^|\/)pages\/(?!api\/)(?!.*\/_)(?!_)(.+)\.[jt]sx?$/;
/**
 * The browser suite: its specs, and the helpers beside them that log in or open a page for them
 * (an adopter's suite opened its login pages from `e2e/session.ts`, which no spec pattern names).
 */
const SUITE =
  /\.(spec|e2e)\.[cm]?[jt]sx?$|(^|\/)(e2e|playwright|browser-tests?)\/.*\.[cm]?[jt]sx?$/;
/** A string that reads as a path of the site: "/x", a template "/x/${id}", "http://host/x". */
const PATH_STRING = /(["'`])((?:https?:\/\/[^/\s"'`]+)?\/(?:(?!\1)[^\s\\])*)\1/g;
/** What a template's placeholder becomes in a visited path: any one segment. */
const ANY = "\u0000";
const DYNAMIC = /^\[.+\]$/;
const CATCH_ALL = /^\[\.\.\..+\]$/;
const OPTIONAL_CATCH_ALL = /^\[\[\.\.\..+\]\]$/;

/**
 * The URL path of a page file, as its segments: route groups and parallel slots dropped.
 * @param {string} file @returns {{ route: string, segs: string[] } | null}
 */
export function routeOf(file) {
  const app = APP_PAGE.exec(file);
  const pages = app ? null : PAGES_PAGE.exec(file);
  if (!app && !pages) return null;
  const rest = app ? String(app[2] || "") : String(pages?.[2] || "").replace(/(^|\/)index$/, "");
  const segs = rest.split("/").filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  if (segs.some((s) => s.startsWith("_"))) return null;
  return { route: "/" + segs.join("/"), segs };
}

/**
 * The paths the browser suite names, origin, query and fragment removed: every path-shaped
 * string, not only a `goto` argument, since suites open pages through constants (`goto(MENU)`)
 * and lists (`for (const path of PAGES)`). A template's placeholder stands for any one segment:
 * `/${portal}/login` opens every portal's login page.
 * @param {string} text @returns {string[]}
 */
export function visitedPaths(text) {
  const out = [];
  for (const m of codeOnly(text, { strings: "keep" }).matchAll(PATH_STRING)) {
    let p = String(m[2]).replace(/\$\{[^}]*\}/g, ANY);
    p = p.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");
    out.push(p || "/");
  }
  return out;
}

/**
 * Whether a visited path opens a route, segment by segment: a dynamic route segment or a
 * placeholder matches any one segment, a catch-all the rest.
 * @param {string[]} route @param {string} visited
 */
export function opens(route, visited) {
  const v = visited.split("/").filter(Boolean);
  for (let i = 0; i < route.length; i++) {
    const r = String(route[i]);
    if (OPTIONAL_CATCH_ALL.test(r)) return true;
    if (CATCH_ALL.test(r)) return v.length > i;
    if (i >= v.length) return false;
    if (!DYNAMIC.test(r) && v[i] !== ANY && v[i] !== r) return false;
  }
  return v.length === route.length;
}

/** @type {import("../index.mjs").Probe[]} */
export const probes = [
  {
    metric: "test.unvisitedRoutes",
    kind: "ratchet",
    optIn: true,
    probation: true,
    standard: ["TEST.3"],
    title: "Pages no browser test opens",
    why: "A page no browser test opens can break with every other number green: its forms, its data loading and its hydration are proven by nothing. The count is where a journey test is missing; a page that genuinely needs none (a legal notice) is a decision to record rather than a test to write.",
    approximates:
      "stands in for knowing which journeys the browser suite drives: a page route declared by file (app/**/page and pages/**, API and special files left out) counts when no path-shaped string in the browser suite (its specs and the helpers in its folder) matches it, a template placeholder matching any one segment; a page reached only by clicking a link is not seen as opened, a path written for another purpose is read as a visit, and opening a page is not submitting its form",
    emptyScanOk: true,
    scan: (c) => {
      const routes = c
        .files(/\.[cm]?[jt]sx?$/)
        .filter((f) => !/(^|\/)node_modules\//.test(f))
        .map((f) => ({ f, r: routeOf(f) }))
        .filter((x) => x.r);
      const visited = c.files(SUITE).flatMap((f) => visitedPaths(c.read(f)));
      const findings = routes
        .filter((x) => !visited.some((v) => x.r && opens(x.r.segs, v)))
        .map((x) => ({ path: x.f, line: 1, detail: `${x.r?.route}: no browser test opens it` }));
      return { scanned: routes.length, findings };
    },
    controls: [
      {
        // A path in a comment opens nothing; a page one segment deeper, or shallower, than a
        // visit is not it.
        name: "a nested page, a pages-router page and a page named only in a comment",
        files: {
          "app/page.tsx": "export default function Home() { return null; }\n",
          "app/(shop)/menu/[id]/page.tsx": "export default function Item() { return null; }\n",
          "app/(shop)/menu/[id]/edit/page.tsx": "export default function Edit() { return null; }\n",
          "pages/about.tsx": "export default function About() { return null; }\n",
          "e2e/home.spec.ts":
            'import { test } from "./fixtures";\ntest("home", async ({ page }) => { await page.goto("/"); await page.goto(`/menu/${id}`); await page.goto("/about/team"); /* goto("/about") */ });\n',
        },
        expect: 2,
      },
      {
        name: "every page opened: a literal, a template, an absolute URL, a helper, a constant",
        files: {
          "app/page.tsx": "export default function Home() { return null; }\n",
          "app/(shop)/menu/[id]/page.tsx": "export default function Item() { return null; }\n",
          "app/admin/login/page.tsx": "export default function Login() { return null; }\n",
          "app/menu/new/page.tsx": "export default function NewItem() { return null; }\n",
          "pages/about.tsx": "export default function About() { return null; }\n",
          "pages/api/orders.ts": "export default function handler() {}\n",
          "pages/_app.tsx": "export default function App() { return null; }\n",
          "e2e/session.ts":
            "export const login = (page, portal) => page.goto(`/${portal}/login`);\n",
          "e2e/journeys.spec.ts": [
            'import { test } from "./fixtures";',
            'const ABOUT = "/about";',
            'test("all", async ({ page }) => {',
            '  await page.goto("/?from=test");',
            "  await page.goto(`/menu/${id}`);",
            '  await page.goto("http://localhost:3000/menu/new#top");',
            "  await page.goto(ABOUT);",
            "});",
            "",
          ].join("\n"),
        },
        expect: 0,
      },
    ],
  },
];
