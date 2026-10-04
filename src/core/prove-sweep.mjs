/**
 * What earlier `prove` runs left in the temporary folder. A run stopped before its own cleanup
 * (a terminal closed, a tool's time limit) leaves its copy, 49 MB on an adopter's monorepo, with
 * the links to the repository's node_modules still in it; and every run keeps its logs. Swept at
 * the start of the next run: a copy no run can still be using is unlinked link by link, never
 * followed, and only then removed; logs go after a week.
 */
import { lstatSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A copy `prove` makes, by the name mkdtemp gives it; a test fixture's name is longer. */
const COPY = /^abatty-prove-[A-Za-z0-9]{6}$/;
/** The folder a run keeps its steps' output in. */
const LOGS = /^abatty-prove-logs-[A-Za-z0-9]{6}$/;
/** Older than this, no run is still using a copy: the longest seen took minutes. */
const COPY_AGE_MS = 2 * 60 * 60 * 1000;
/** Logs are read the day of the run; a week is generous. */
const LOGS_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Unlink every link under a folder without following one, so removing the folder afterwards can
 * never reach what a link points at (the repository's own node_modules). False when a link would
 * not go: the folder is then left where it is.
 * @param {string} dir @returns {boolean}
 */
function unlinkAll(dir) {
  const todo = [dir];
  while (todo.length) {
    const at = String(todo.pop());
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      const st = lstatSync(path);
      if (st.isSymbolicLink()) {
        try {
          unlinkSync(path); // a junction reads as a link on Windows, and unlinks as one
        } catch {
          return false;
        }
      } else if (st.isDirectory() && name !== ".git") todo.push(path);
    }
  }
  return true;
}

/**
 * Remove what earlier runs left: copies older than two hours, logs older than a week. Returns
 * how many of each went, for a test; a folder that cannot be read is passed over.
 * @param {{ dir?: string, now?: number }} [o] @returns {{ copies: number, logs: number }}
 */
export function sweepStale(o = {}) {
  const dir = o.dir || tmpdir();
  const now = o.now ?? Date.now();
  const out = { copies: 0, logs: 0 };
  for (const name of readdirSync(dir)) {
    const kind = COPY.test(name) ? "copies" : LOGS.test(name) ? "logs" : "";
    if (!kind) continue;
    const path = join(dir, name);
    try {
      const age = now - statSync(path).mtimeMs;
      if (age < (kind === "copies" ? COPY_AGE_MS : LOGS_AGE_MS)) continue;
      if (!unlinkAll(path)) continue;
      rmSync(path, { recursive: true, force: true });
      out[kind]++;
    } catch {
      // Another run's, or one the system holds: left for the next sweep.
    }
  }
  return out;
}
