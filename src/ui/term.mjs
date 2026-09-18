/**
 * The terminal: colour, glyphs, bars and tables, with no dependency. Colour is on when stdout
 * is a TTY, NO_COLOR is unset and CI is unset; every helper degrades to plain text otherwise,
 * so a log file or a pipe reads the same words without the escapes.
 */

const enabled = () =>
  Boolean(process.stdout.isTTY) &&
  !process.env.NO_COLOR &&
  !process.env.CI &&
  process.env.TERM !== "dumb";

/** @param {number} open @param {number} close */
const wrap = (open, close) => (/** @type {string} */ s) =>
  enabled() ? `[${open}m${s}[${close}m` : s;

export const bold = wrap(1, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const magenta = wrap(35, 39);
export const cyan = wrap(36, 39);
export const gray = wrap(90, 39);

export const glyph = {
  ok: green("✓"),
  fail: red("✗"),
  skip: gray("·"),
  defer: yellow("↷"),
  run: cyan("▶"),
  warn: yellow("!"),
  dot: gray("•"),
  arrow: gray("→"),
};

/** A status word, coloured the way every screen colours it. @param {string} s */
export function status(s) {
  switch (s) {
    case "present":
    case "ok":
    case "in step":
    case "done":
      return green(s);
    case "partial":
    case "deferred":
    case "differs":
    case "in_progress":
      return yellow(s);
    case "missing":
    case "failed":
    case "blocked":
      return red(s);
    case "waived":
    case "n/a":
      return gray(s);
    default:
      return gray(s);
  }
}

/**
 * A horizontal bar for a 0..100 value: filled with the colour of the band it sits in.
 * @param {number} value @param {number} [width]
 */
export function bar(value, width = 24) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round((v / 100) * width);
  const paint = v >= 90 ? green : v >= 70 ? yellow : red;
  return paint("█".repeat(filled)) + gray("░".repeat(width - filled));
}

/** A stacked three-colour bar for present / partial / missing counts. @param {number} p @param {number} q @param {number} m @param {number} [width] */
export function stacked(p, q, m, width = 20) {
  const total = p + q + m;
  if (!total) return gray("░".repeat(width));
  const a = Math.round((p / total) * width);
  const b = Math.round((q / total) * width);
  const c = Math.max(0, width - a - b);
  // Without colour the three bands still read: full, half, light.
  if (!enabled()) return "█".repeat(a) + "▒".repeat(b) + "░".repeat(c);
  return green("█".repeat(a)) + yellow("█".repeat(b)) + red("█".repeat(c));
}

/**
 * A table with aligned columns; the first row is the header. Cells may carry colour: widths
 * are computed on the visible text.
 * @param {string[][]} rows @param {{ indent?: number, align?: ("l"|"r")[] }} [o]
 */
export function table(rows, o = {}) {
  const visible = (/** @type {string} */ s) => s.replace(/\[[0-9;]*m/g, "");
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(...rows.map((r) => visible(r[i] ?? "").length)),
  );
  const pad = " ".repeat(o.indent ?? 2);
  const line = (/** @type {string[]} */ r, /** @type {boolean} */ head) =>
    pad +
    r
      .map((cell, i) => {
        const w = widths[i] ?? 0;
        const gap = w - visible(cell ?? "").length;
        const right = (o.align?.[i] ?? "l") === "r";
        const text = head ? bold(cell ?? "") : (cell ?? "");
        return right ? " ".repeat(gap) + text : text + " ".repeat(gap);
      })
      .join("  ")
      .trimEnd();
  const out = rows.map((r, i) => line(r, i === 0));
  out.splice(1, 0, pad + gray(widths.map((w) => "─".repeat(w)).join("  ")));
  return out.join("\n");
}

/** A section title. @param {string} text @param {string} [sub] */
export function heading(text, sub = "") {
  return `\n${bold(text)}${sub ? "  " + gray(sub) : ""}\n`;
}

/** A key: value line. @param {string} k @param {string} v */
export function kv(k, v) {
  return `  ${gray(k.padEnd(14))} ${v}`;
}

/** Milliseconds as a short duration. @param {number} ms */
export function duration(ms) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

/** The product's one-line banner. @param {string} version */
export function banner(version) {
  return `${bold(magenta("abatty"))} ${gray("v" + version)}`;
}
