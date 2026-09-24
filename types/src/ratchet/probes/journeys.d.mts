/**
 * The URL path of a page file, as its segments: route groups and parallel slots dropped.
 * @param {string} file @returns {{ route: string, segs: string[] } | null}
 */
export function routeOf(file: string): {
    route: string;
    segs: string[];
} | null;
/**
 * The paths the browser suite names, origin, query and fragment removed: every path-shaped
 * string, not only a `goto` argument, since suites open pages through constants (`goto(MENU)`)
 * and lists (`for (const path of PAGES)`). A template's placeholder stands for any one segment:
 * `/${portal}/login` opens every portal's login page.
 * @param {string} text @returns {string[]}
 */
export function visitedPaths(text: string): string[];
/**
 * Whether a visited path opens a route, segment by segment: a dynamic route segment or a
 * placeholder matches any one segment, a catch-all the rest.
 * @param {string[]} route @param {string} visited
 */
export function opens(route: string[], visited: string): boolean;
/** @type {import("../index.mjs").Probe[]} */
export const probes: import("../index.mjs").Probe[];
