/** A status word, coloured the way every screen colours it. @param {string} s */
export function status(s: string): string;
/**
 * A horizontal bar for a 0..100 value: filled with the colour of the band it sits in.
 * @param {number} value @param {number} [width]
 */
export function bar(value: number, width?: number): string;
/** A stacked three-colour bar for present / partial / missing counts. @param {number} p @param {number} q @param {number} m @param {number} [width] */
export function stacked(p: number, q: number, m: number, width?: number): string;
/**
 * A table with aligned columns; the first row is the header. Cells may carry colour: widths
 * are computed on the visible text.
 * @param {string[][]} rows @param {{ indent?: number, align?: ("l"|"r")[] }} [o]
 */
export function table(rows: string[][], o?: {
    indent?: number;
    align?: ("l" | "r")[];
}): string;
/** A section title. @param {string} text @param {string} [sub] */
export function heading(text: string, sub?: string): string;
/** A key: value line. @param {string} k @param {string} v */
export function kv(k: string, v: string): string;
/** Milliseconds as a short duration. @param {number} ms */
export function duration(ms: number): string;
/** The product's one-line banner. @param {string} version */
export function banner(version: string): string;
export function bold(s: string): string;
export function red(s: string): string;
export function green(s: string): string;
export function yellow(s: string): string;
export function magenta(s: string): string;
export function cyan(s: string): string;
export function gray(s: string): string;
export namespace glyph {
    let ok: string;
    let fail: string;
    let skip: string;
    let defer: string;
    let run: string;
    let warn: string;
    let dot: string;
    let arrow: string;
}
