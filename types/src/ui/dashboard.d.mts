/**
 * The dashboard: one self-contained HTML page over the reports of one or more repositories.
 * No framework, no network needed - the data is embedded, the page runs anywhere it is opened
 * (the fonts load from Google when online and fall back to the system faces when not), and it
 * reads in light and dark. Built by `abatty dashboard`; the hosted version serves the same
 * reports through the same page.
 *
 * It is an instrument panel, not a document: the summary before the detail, state encoded in
 * form (a marker, a chip) as well as number, semantic colour kept apart from the accent.
 */
/**
 * @param {{ name: string, reports: import("../core/report.mjs").Report[] }[]} repos
 * @param {{ abattyVersion?: string }} [o]
 */
export function renderDashboard(repos: {
    name: string;
    reports: import("../core/report.mjs").Report[];
}[], o?: {
    abattyVersion?: string;
}): string;
