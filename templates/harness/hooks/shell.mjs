/**
 * Reading a shell command as a command. Its own file because it is its own responsibility: the
 * hooks' lib is utilities, and this is a parser. Kept typecheckable on its own so the package's
 * suite can import it directly, the way it imports the shim.
 */
import { resolve as resolvePath } from "node:path";

// ---- reading a shell command without being a shell -----------------------------------------
// Five families of hole in this harness came from matching a regex against a whole command line:
// a flag bundled into a cluster, HEAD read as a branch name, a redirection token read as a
// refspec, a quoted branch, a quoted flag. Each was the same mistake, that the text of a command
// is not its structure. This splits a command into segments and tokens the way a shell would,
// so a rule can ask what git was actually asked to do rather than what the line happens to say.
//
// The safety rule is the inversion that makes it shippable: a segment gets the precise treatment
// only when its program is one we recognise. `git` and `gh` are read precisely. A small set of
// readers that cannot reach a program of their own is skipped entirely, which is what stops a
// search pattern reading as a real command. EVERYTHING ELSE falls back to the old whole-string
// match, because a list of wrappers can never be complete: sh, bash, eval and xargs are the
// obvious ones, and timeout, nice, stdbuf, sudo, doas, setsid, script and find -exec are the
// ones a list forgets. Precision where the command parses, the blunt instrument where it does
// not, and never the other way round.

/** Programs that read and cannot run a program of their own, so their arguments are text. */
const READERS = new Set([
  "grep", "egrep", "fgrep", "rg", "ack", "ag", "echo", "printf", "cat", "head", "tail",
  "wc", "cut", "tr", "sort", "uniq", "less", "more", "jq", "column", "diff", "comm", "rev",
  "basename", "dirname", "realpath", "file", "stat", "du", "ls",
]);
// Deliberately absent: awk (system()), sed (GNU's `e`), perl, python, node, ruby, xargs, find.
// Each can reach a program, so each takes the conservative path.

/** A program's name as a rule knows it: no directory, and no extension Windows adds.
 *  @param {string | undefined} t @returns {string} */
export const programName = (t) => {
  const parts = String(t || "")
    .replace(/^\\/, "")
    .split(/[\\/]/);
  return (parts[parts.length - 1] || "").replace(/\.(exe|cmd|bat|com)$/i, "");
};

/**
 * Split on `;`, `&&`, `||`, `|` and `&` that are OUTSIDE quotes. A `&` belonging to a
 * redirection (`2>&1`) is not a separator, so it stays with the segment it redirects.
 * @param {string} s @param {boolean} [ps] PowerShell: a backslash is a path character @returns {string[]}
 */
function splitSegments(s, ps = false) {
  const out = [];
  let cur = "";
  let q = /** @type {string | null} */ (null);
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (q) {
      cur += c;
      if (c === q) q = null;
      else if (!ps && q === '"' && c === "\\" && i + 1 < s.length) cur += s.charAt(++i);
      continue;
    }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (!ps && c === "\\" && i + 1 < s.length) { cur += c + s.charAt(++i); continue; }
    if (c === ";" || c === "\n") { out.push(cur); cur = ""; continue; }
    if (c === "|" || (c === "&" && !/[>\d]$/.test(cur))) {
      if (s[i + 1] === c) i++;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * One segment into tokens, quotes consumed as the shell consumes them, so a quoted flag is the
 * flag and `'a;b'` is one token rather than two segments. An unterminated quote is reported
 * rather than guessed at.
 * @param {string} s @param {boolean} [ps] PowerShell: a backslash is a path character @returns {{ tokens: string[], unterminated: boolean }}
 */
function tokenize(s, ps = false) {
  const tokens = [];
  let cur = "";
  let started = false;
  let q = /** @type {string | null} */ (null);
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (q) {
      if (c === q) { q = null; continue; }
      if (!ps && q === '"' && c === "\\" && i + 1 < s.length) { cur += s.charAt(++i); started = true; continue; }
      cur += c;
      started = true;
      continue;
    }
    if (c === "'" || c === '"') { q = c; started = true; continue; }
    if (!ps && c === "\\" && i + 1 < s.length) { cur += s.charAt(++i); started = true; continue; }
    if (/\s/.test(c)) { if (started) { tokens.push(cur); cur = ""; started = false; } continue; }
    cur += c;
    started = true;
  }
  if (started) tokens.push(cur);
  return { tokens, unterminated: q !== null };
}

/**
 * Redirections are the shell's: drop the operator and, when it stands alone, its operand.
 * @param {string[]} tokens @returns {string[]}
 */
function stripRedirections(tokens) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] || "";
    if (/^(\d*(>>?|<)|&>>?)$/.test(t)) { i++; continue; }
    if (/^(\d*(>>?|<)|&>)/.test(t)) continue;
    out.push(t);
  }
  return out;
}

/**
 * A segment without the parentheses of a subshell it opens or closes: `(cd wt && git push origin
 * main)` split into `(cd wt` and `git push origin main)`, and the destination read as `main)`,
 * which is no branch, so the push to main went through. A `$( )` keeps its own parentheses; only
 * a leading `(` and a trailing `)` with no partner inside the segment are the subshell's; how
 * many of each is how segmentDirs undoes a `cd` made inside it.
 * @param {string} seg
 */
function ungroup(seg) {
  let text = seg;
  let opens = 0;
  let closes = 0;
  while (text.startsWith("(")) {
    text = text.slice(1).trimStart();
    opens++;
  }
  const count = (/** @type {string} */ c) => text.split(c).length - 1;
  while (text.endsWith(")") && count(")") > count("(")) {
    text = text.slice(0, -1).trimEnd();
    closes++;
  }
  return { text, opens, closes };
}

/**
 * A command as segments a rule can question. Each carries the program's bare name, the arguments
 * after it, the raw text it came from, and `opaque`: true when this segment must NOT be trusted
 * to a precise reading, because the program is unknown, is reached through a substitution or a
 * variable, or the quoting does not close. An opaque segment is the caller's cue to fall back.
 * PowerShell takes a backslash as part of a path, where bash takes it as an escape: read the bash
 * way, `C:\Users\me\wt` reached the folder resolution as `C:Usersmewt` and every push after it
 * was refused as going nowhere known.
 * @param {string} raw @param {{ powershell?: boolean }} [o]
 * @returns {{ program: string, args: string[], tokens: string[], raw: string, opaque: boolean }[]}
 */
export function shellSegments(raw, o = {}) {
  const ps = o.powershell === true;
  return splitSegments(String(raw || ""), ps).map((seg) => {
    const { tokens, unterminated } = tokenize(ungroup(seg).text, ps);
    const words = stripRedirections(tokens);
    let i = 0;
    // Leading `VAR=value` assignments belong to the environment, not to the command.
    while (i < words.length && /^[A-Za-z_]\w*=/.test(words[i] || "")) i++;
    const program = programName(words[i]);
    const args = words.slice(i + 1);
    // A substitution or a variable in command position means the text and the execution can
    // disagree, which is the one thing a precise reading must never be asked to cover.
    const substituted = /\$\(|`|\$\{|\$[A-Za-z_]/.test(seg);
    const known = program === "git" || program === "gh" || READERS.has(program);
    // `tokens` is the whole list, because an opaque segment has no trustworthy program and its
    // caller must be able to ask "could this be git?" of everything in it. `$(echo git) push
    // --force` carries no contiguous `git push` for a pattern to find, which is why every
    // version through 0.3.3 allowed it.
    return { program, args, tokens: words, raw: seg, opaque: unterminated || substituted || !known };
  });
}

// ---- where each segment runs -----------------------------------------------------------------
// A command's segments do not all run in the hook's folder: `cd <worktree> && git push` pushes
// the worktree's branch. The guard asked git for the branch once, in its own folder, so a bare
// push from a worktree was judged by another checkout's branch: refused when that checkout stood
// on main, and allowed when it stood on a feature branch while the worktree was on main. An
// adopter whose sessions push from worktrees all day hit the first on the first day.

/** The commands that move the shell, whatever the shell. */
const CD = new Set(["cd", "pushd", "chdir", "Set-Location", "sl", "Push-Location"]);

/**
 * A path as the shell handed it, resolved against `dir`, or null when this cannot know it: a
 * variable, a substitution, `cd -`, a `~user`. Git Bash spells a Windows drive `/c/...`, which
 * the path module would read as a folder named `c` on the current drive.
 * @param {string} dir @param {string | undefined} target @param {string} home
 * @returns {string | null}
 */
function resolveDir(dir, target, home) {
  if (target === undefined) return home || null;
  if (!target || target === "-" || /[$`*?]/.test(target)) return null;
  let t = target.replace(/^["']|["']$/g, "");
  if (t === "~" || t.startsWith("~/")) {
    if (!home) return null;
    t = home + t.slice(1);
  } else if (t.startsWith("~")) return null;
  if (process.platform === "win32") t = t.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:");
  return resolvePath(dir, t);
}

/**
 * The folder each segment of a command runs in, in order, or null from the point this cannot
 * follow the shell: a `cd` it cannot resolve, a `popd`. A subshell's `cd` holds inside it and is
 * undone where it closes. A caller that needs the folder and gets null must fail closed rather
 * than guess the hook's own.
 * @param {{ program: string, args: string[], raw: string }[]} segments
 * @param {string} start the hook's folder @param {string} [home]
 * @returns {(string | null)[]}
 */
export function segmentDirs(segments, start, home = "") {
  /** @type {string | null} */
  let dir = start;
  /** @type {(string | null)[]} */
  const outer = [];
  return segments.map((s) => {
    const { opens, closes } = ungroup(s.raw);
    for (let n = 0; n < opens; n++) outer.push(dir);
    let here = dir;
    if (s.program === "popd" || s.program === "Pop-Location") dir = null;
    // A `cd` this reading cannot follow: inside a group (`{ cd wt; ... }`), a condition
    // (`if cd wt; then`), a builtin prefix, `env -C`, or a wrapper's quoted text. The folder is
    // unknown from here on, this segment included, rather than the hook's own guessed.
    else if (!CD.has(s.program) && /(^|[\s;{(&|"'])(cd|pushd|builtin\s+cd|Set-Location)\s|\benv\s+(-C|--chdir)\b/.test(s.raw))
      here = dir = null;
    else if (CD.has(s.program)) {
      const target = s.args.filter((a) => !/^-[LPe@]$|^-Path$/i.test(a))[0];
      dir = dir === null ? null : resolveDir(dir, target, home);
    }
    for (let n = 0; n < closes && outer.length; n++) dir = outer.pop() ?? null;
    return here;
  });
}

/**
 * git's own options that move it before the subcommand: `-C <path>`, `--git-dir`, `--work-tree`,
 * in both spellings. Returned as arguments to hand to another git call, or null when one names a
 * path this cannot know.
 * @param {string[]} args the arguments after `git`
 * @returns {string[] | null}
 */
export function gitLocation(args) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] || "";
    if (!a.startsWith("-")) break;
    const pair = a === "-C" || a === "--git-dir" || a === "--work-tree";
    const value = pair ? args[++i] : /^--(git-dir|work-tree)=/.test(a) ? a.slice(a.indexOf("=") + 1) : null;
    if (value === null) {
      // An option that takes its value as the next word is not a location, and neither is the
      // word: stopping at it dropped a `-C` behind `--namespace x`, and the push was judged by
      // the hook's own folder.
      if (/^(-c|--namespace|--config-env|--attr-source|--super-prefix)$/.test(a)) i++;
      continue;
    }
    if (value === undefined || /[$`]/.test(value)) return null;
    out.push(...(pair ? [a, value] : [a]));
  }
  return out;
}
