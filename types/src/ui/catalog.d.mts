/**
 * @param {import("../rules/index.mjs").CatalogRule[]} rules
 * @param {{ title?: string }} [o]
 */
export function renderCatalogMarkdown(rules: import("../rules/index.mjs").CatalogRule[], o?: {
    title?: string;
}): string;
