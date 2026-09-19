/**
 * @param {{ version: string, presets: { id: string }[] }} o
 * @returns {string}
 */
export function renderHelp(o: {
    version: string;
    presets: {
        id: string;
    }[];
}): string;
