/** Ask for plain output: no colour, and glyphs a byte-oriented reader can match on. @param {boolean} on */
export function setPlain(on: boolean): void;
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
/**
 * Whether this console can show UTF-8. abatty writes UTF-8 always, and a classic Windows console
 * (PowerShell 5.1, cmd) decodes it in its OEM code page: an adopter read "Ô£ù gate red ┬À". The
 * terminals known to show it are trusted (Windows Terminal, VS Code, an MSYS shell such as Git
 * Bash, any CI log); `ABATTY_ASCII=1` or `=0` settles it either way.
 * @param {NodeJS.ProcessEnv} env @param {string} platform @returns {boolean}
 */
export function asciiOnly(env: NodeJS.ProcessEnv, platform: string): boolean;
/** A screen's text with abatty's symbols written in ASCII; everything else as it was. @param {string} s */
export function toAscii(s: string): string;
export function bold(s: string): string;
export function red(s: string): string;
export function green(s: string): string;
export function yellow(s: string): string;
export function magenta(s: string): string;
export function cyan(s: string): string;
export function gray(s: string): string;
export namespace glyph {
    const ok: string;
    const fail: string;
    const skip: string;
    const defer: string;
    const run: string;
    const warn: string;
    const dot: string;
    const arrow: string;
}
