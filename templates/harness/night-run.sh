#!/usr/bin/env bash
# Linux/macOS twin of night-run.ps1. Same contract, same files, same env for the hooks.
#   ./night-run.sh <repo> [until=07:00] [max-cost-usd=60] [phases="0 1 2"] [model=opus] [effort=high] [mode=auto]
#   ABATTY_AGENT=/path/to/testing/stub-agent.sh ./night-run.sh ...   drives the loop with the stub
#   NO_PUSH=1 ./night-run.sh ...                                     keeps the branch local
#   SKIP_CANARY=1 ./night-run.sh ...                                 skips the pre-flight session
#   CANARY_ONLY=1 ./night-run.sh <repo>                              pre-flight on the current branch, then stop
#
# Before the first phase the runner proves four things or refuses the night: the harness self-test
# is green, .claude/ is identical to the base branch, the gate is green on the branch as it starts,
# and a canary session (a real `the agent's headless mode` under the night flags) ran a command through auto mode,
# was refused a --no-verify commit by the guard, had its stop judged by the Stop hook, and saw no
# MCP tool but the ones .claude/mcp.night.json names. Every session runs with --strict-mcp-config:
# the mail, chat and drive connectors of the user settings do not exist at night. A repository
# that wants an MCP server at night declares it in .claude/mcp.night.json AND in adoption.json ->
# mcpServers; protect.mjs denies every other server's tools.
set -euo pipefail

REPO="${1:?repo path}"; UNTIL="${2:-07:00}"; MAX_COST="${3:-60}"; PHASES_ARG="${4:-}"
MODEL="${5:-opus}"; EFFORT="${6:-high}"; MODE="${7:-auto}"
# The agent's executable: ABATTY_AGENT, else agent.command in ~/.abatty/config.json. Never a default here.
if [ -z "${ABATTY_AGENT:-}" ] && [ -f "$HOME/.abatty/config.json" ]; then
  ABATTY_AGENT="$(node -e "try{const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(c.agent&&c.agent.command||'')}catch{}" "$HOME/.abatty/config.json")"
fi
[ -n "${ABATTY_AGENT:-}" ] || { echo "no agent command: set ABATTY_AGENT or agent.command in ~/.abatty/config.json" >&2; exit 2; }
# Git Bash on Windows rewrites an argument that starts with "/" into a Windows path, so the
# prompt "/adopt-standards --phase N" would reach agent as "C:/Program Files/Git/adopt-standards"
# and the skill would never be invoked. This excludes only that prefix from the conversion
# (MSYS_NO_PATHCONV=1 would also break every POSIX path handed to a native executable).
# Ignored everywhere else.
export MSYS2_ARG_CONV_EXCL="/adopt-standards"
cd "$REPO"

[ -z "$(git status --porcelain)" ] || { echo "dirty tree; commit or stash first:" >&2; git status --porcelain >&2; exit 1; }
git fetch --prune >/dev/null

cfg() { node -e "const c=require('./.claude/adoption.json');const v=c$1;console.log(v===undefined?'':Array.isArray(v)?v.join(' '):v)"; }
BASE="$(cfg .baseBranch)"; BASE="${BASE:-main}"
PREFIX="$(cfg .branchPrefix)"; PREFIX="${PREFIX:-adopt/standards}"
STATE="$(cfg .files.state)"; STATE="${STATE:-docs/ADOPTION_STATE.json}"
DECISIONS="$(cfg .files.decisions)"; DECISIONS="${DECISIONS:-docs/ADOPTION_DECISIONS.md}"
GATE_CMD="$(cfg .commands.gate)"; GATE_CMD="${GATE_CMD:-npm run gate:fast}"
MAX_SESSIONS="$(cfg .maxSessionsPerPhase)"; MAX_SESSIONS="${MAX_SESSIONS:-2}"
PHASES="${PHASES_ARG:-$(cfg .phases)}"

DATE="$(date +%F)"; BRANCH="$PREFIX-$DATE"
if [ -n "${CANARY_ONLY:-}" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
# The LOCAL base when it exists: it is what carries a harness committed but not pushed yet.
elif git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout -q "$BRANCH"
elif git show-ref --verify --quiet "refs/heads/$BASE"; then git checkout -q -b "$BRANCH" "$BASE"
else git checkout -q -b "$BRANCH" "origin/$BASE"; fi
for needed in .claude/settings.json .claude/adoption.json .claude/hooks/stop-gate.mjs .claude/hooks/guard.mjs .claude/hooks/protect.mjs .claude/hooks/check-direction.mjs .claude/skills/adopt-standards/SKILL.md; do
  [ -f "$needed" ] || { echo "harness incomplete on $BRANCH - missing $needed; commit the templates on $BASE first" >&2; exit 1; }
done
# Proven on the branch that will run, after the checkout: the hooks that matter are these.
node .claude/hooks/self-test.mjs || { echo "harness self-test failed; fix it before running unattended" >&2; exit 1; }

# The hooks that judge the night are the ones a human committed on the base: identical, or no night.
assert_harness_untouched() {
  local moved; moved="$(git diff --name-only "$BASE" -- .claude/)"
  if [ -n "$moved" ]; then
    echo "the harness (.claude/) differs from $BASE $1:" >&2; echo "$moved" >&2
    echo "a night runs on the hooks a human committed; restore them (git checkout $BASE -- .claude/) or commit the change on $BASE first" >&2
    return 1
  fi
}
assert_harness_untouched "at the start"

NIGHT=".claude/night/$DATE"; mkdir -p "$NIGHT"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"startedAt":"%s","branch":"%s","base":"%s","until":"%s","maxCostUsd":%s}\n' "$STARTED" "$BRANCH" "$BASE" "$UNTIL" "$MAX_COST" > .claude/night/run.json

# The MCP servers a session may have at all: the committed .claude/mcp.night.json when the
# repository has one (under .claude/: read-only to the worker, identical to the base or no night),
# else an empty one written here. Each server it loads must be named in adoption.json ->
# mcpServers or every call to it is denied by protect.mjs.
if [ -f .claude/mcp.night.json ]; then MCP_CONFIG="$(cd .claude && pwd)/mcp.night.json"
else printf '{"mcpServers":{}}\n' > "$NIGHT/mcp-none.json"; MCP_CONFIG="$(cd "$NIGHT" && pwd)/mcp-none.json"; fi
MCP_SERVERS="$(node -e "const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(Object.keys(c.mcpServers||{}).join(' '))" "$MCP_CONFIG")"
for srv in $MCP_SERVERS; do
  case " $(cfg .mcpServers) " in *" $srv "*) ;; *) echo "$MCP_CONFIG loads the MCP server '$srv' but adoption.json -> mcpServers does not name it: every call to it would be denied. Name it in both, or in neither." >&2; exit 1 ;; esac
done
echo "MCP at night: ${MCP_SERVERS:-none} ($MCP_CONFIG)" >&2

# Pre-flight: the gate is green before anything is asked of the model. A red gate at the start
# is not the phase's doing and would be read as a blocked phase in the morning.
echo "[$(date +%H:%M)] pre-flight: $GATE_CMD" >&2
if ! bash -c "$GATE_CMD" > "$NIGHT/preflight-gate.txt" 2>&1; then
  echo "the gate is red on $BRANCH before the night started ($GATE_CMD); fix it by day, a night cannot:" >&2; tail -n 25 "$NIGHT/preflight-gate.txt" >&2; exit 1
fi

# One `the agent's headless mode` under the night flags. Sets R_EXIT, R_PARSED, R_COST, R_DENIALS, R_JSON (path).
run_agent() {
  local prompt="$1" budget="$2" name="$3" out_base="$4" out err
  out="$out_base.json"; err="$out_base.stderr.txt"
  echo "[$(date +%H:%M)] $name" >&2
  set +e
  "$ABATTY_AGENT" -p "$prompt" --permission-mode "$MODE" --permission-prompts none --output-format json \
    --max-budget-usd "$budget" --model "$MODEL" --effort "$EFFORT" --strict-mcp-config --mcp-config "$MCP_CONFIG" \
    -n "$name" > "$out" 2> "$err"
  R_EXIT=$?
  set -e
  R_JSON="$out"
  R_PARSED="$(node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(1)}catch{console.log(0)}" "$out")"
  R_DENIALS="$(node -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log((j.permission_denials||[]).length)}catch{console.log(0)}" "$out")"
  R_COST="$(node -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(j.total_cost_usd||0)}catch{console.log(0)}" "$out")"
  echo "  exit $R_EXIT, cost $R_COST USD, $R_DENIALS permission denial(s)" >&2
  # A non-zero exit WITHOUT a result is the CLI failing to run, not a session that worked and
  # stopped. Counting it as a session would hide the cause under "blocked after N sessions".
  if [ "$R_EXIT" -ne 0 ] && [ "$R_PARSED" = "0" ]; then
    echo "  the session did not produce a result (exit $R_EXIT). stderr:" >&2; tail -n 12 "$err" >&2
    R_CRASHED=1
  else
    R_CRASHED=0
  fi
}
json_field() { node -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const v=j[process.argv[2]];console.log(v===undefined||v===null?'':String(v))}catch{console.log('')}" "$1" "$2"; }

# Pre-flight: the canary session. Three tool calls and a two-part answer prove, for about a
# dollar, that a real -p session under these flags runs a command without a prompt, that the
# guard fires inside it, that the Stop hook does, and that no MCP server but the declared ones
# reached the session - before a night is spent finding out.
run_canary() {
  local head answer last sid receipt failed=() started_epoch
  head="$(git rev-parse --short HEAD)"; started_epoch="$(date +%s)"
  export ADOPTION_RUN=1 ADOPTION_BRANCH="$BRANCH" ADOPTION_BASE="$BASE" ADOPTION_UNTIL="$UNTIL"; unset ADOPTION_PHASE
  run_agent "Canary for the night harness. Do exactly these three things with the Bash tool and nothing else. First, run: git rev-parse --short HEAD. Second, run: git commit --allow-empty --no-verify -m canary - a hook must refuse it; if it is refused, do not retry it in any other form and do not work around it. Third, reply with the short hash printed by the first command, then one space, then the names of every tool available to you whose name starts with mcp__ separated by commas, or the single word none if there is no such tool. Nothing else." 2.00 "adopt-canary-$DATE" "$NIGHT/canary"
  unset ADOPTION_RUN ADOPTION_BRANCH ADOPTION_BASE ADOPTION_UNTIL
  if [ "$R_CRASHED" = "1" ]; then failed+=("the CLI produced no result (exit $R_EXIT)")
  elif [ "$(json_field "$R_JSON" is_error)" = "true" ]; then failed+=("the session reported an error: $(json_field "$R_JSON" result)")
  else
    answer="$(json_field "$R_JSON" result | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//')"
    [ "${answer%% *}" = "$head" ] || failed+=("a Bash command did not run through auto mode without a prompt (expected the answer to start with '$head', got '$answer'; $R_DENIALS denial(s) - if many, auto mode is unavailable to -p here: rerun with mode dontAsk)")
    # The session's own account of its MCP tools against the servers the night declares: a server
    # it has that is not declared means --strict-mcp-config did not take; a declared one with no
    # tool did not start. Prints one finding per line, or nothing.
    while IFS= read -r line; do [ -n "$line" ] && failed+=("$line"); done < <(node -e '
      const [answer, declaredRaw, cfgPath] = process.argv.slice(1);
      const words = answer.split(/\s+/).filter(Boolean);
      if (words.length < 2) { console.log("the canary did not report its MCP tools (answer " + JSON.stringify(answer) + "): whether --strict-mcp-config took is unproven"); process.exit(0); }
      const norm = (x) => String(x).replace(/[^A-Za-z0-9_]/g, "_");
      const reported = words.slice(1).join(" ").split(/[,\s]+/).filter((w) => w && w !== "none");
      const seen = [...new Set(reported.map((t) => (t.match(/^mcp__(.+?)__/) || [null, t])[1]))];
      const declared = declaredRaw.split(/\s+/).filter(Boolean).map(norm);
      for (const s of seen) if (!declared.includes(s)) console.log("the session has MCP tools from " + JSON.stringify(s) + " which " + cfgPath + " does not declare: --strict-mcp-config did not take, and the user connectors would act at night with no hook watching");
      for (const s of declared) if (!seen.includes(s)) console.log("the declared MCP server " + JSON.stringify(s) + " gave the session no tool: it did not start (read the canary stderr)");
    ' "$answer" "$MCP_SERVERS" "$MCP_CONFIG")
    last="$(git log -1 --format=%s)"
    if [ "$last" = "canary" ]; then git reset -q --hard HEAD~1; failed+=("the PreToolUse guard did NOT run: the --no-verify commit landed (removed again); hooks from .claude/settings.json are not firing in -p sessions here"); fi
    if [ "$last" != "canary" ]; then
      node -e "const fs=require('fs');const f='.claude/night/guard-denials.jsonl';const since=Number(process.argv[1])-5;let ok=false;if(fs.existsSync(f))for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/)){if(!l)continue;try{const d=JSON.parse(l);if(/no-verify/.test(d.command||'')&&Date.parse(d.at)/1000>=since)ok=true}catch{}}process.exit(ok?0:1)" "$started_epoch" \
        || failed+=("the guard left no denial in .claude/night/guard-denials.jsonl for the --no-verify commit: the model may not have attempted it, so the guard is unproven (read $NIGHT/canary.json)")
    fi
    sid="$(json_field "$R_JSON" session_id)"; receipt=".claude/night/stop-gate-$sid.json"
    if [ -z "$sid" ] || [ ! -f "$receipt" ]; then failed+=("the Stop hook left no receipt ($receipt): it did not run in this -p session")
    else
      [ "$(json_field "$receipt" decision)" = "allow" ] || failed+=("the Stop hook did run but did not allow the stop: $(json_field "$receipt" decision) - $(json_field "$receipt" reason)")
      [ "$(json_field "$receipt" configSource)" = "base" ] || failed+=("the Stop hook read adoption.json from the tree, not from $BASE")
    fi
    if [ -n "$(git status --porcelain | grep -v '\.claude/night/' || true)" ]; then failed+=("the canary left the tree dirty"); fi
  fi
  if [ "${#failed[@]}" -gt 0 ]; then
    echo "canary failed - the night would not have been what it claims. ${#failed[@]} finding(s):" >&2
    printf -- '- %s\n' "${failed[@]}" >&2
    echo "read $NIGHT/canary.json and $NIGHT/canary.stderr.txt" >&2
    return 1
  fi
  echo "  canary ok: a command ran without a prompt, the guard refused --no-verify, the Stop hook allowed the stop reading adoption.json from $BASE, MCP servers declared: ${MCP_SERVERS:-none} ($R_COST USD)" >&2
  CANARY_COST="$R_COST"
}

SPENT=0; CANARY_COST=0
if [ -z "${SKIP_CANARY:-}" ]; then run_canary; SPENT="$CANARY_COST"; fi
if [ -n "${CANARY_ONLY:-}" ]; then
  rm -f .claude/night/run.json
  echo "pre-flight done on $BRANCH: self-test green, harness identical to $BASE, gate green, canary green. $SPENT USD."
  exit 0
fi

if [ ! -f "$STATE" ]; then
  mkdir -p "$(dirname "$STATE")"
  node -e "const p=process.argv[1].split(' ').filter(Boolean).map(Number);require('fs').writeFileSync(process.argv[2],JSON.stringify({startedAt:process.argv[3],baseBranch:process.argv[4],phases:p.map(id=>({id,status:'pending'}))},null,2)+'\n')" "$PHASES" "$STATE" "$STARTED" "$BASE"
  # Read back the way the hooks will, before it is committed and trusted for a night.
  node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!Array.isArray(s.phases)||!s.phases.length||!s.startedAt){console.error('state file: phases must be a non-empty array with startedAt');process.exit(1)}" "$STATE"
  git add "$STATE"; git commit -q -m "chore(standards): open the adoption state for $DATE"
fi

deadline_epoch() { local d; d="$(date -d "today $UNTIL" +%s 2>/dev/null || date -j -f "%H:%M" "$UNTIL" +%s)"; [ "$d" -le "$(date +%s)" ] && d=$((d + 86400)); echo "$d"; }
status_of() { node -e "const s=require('./'+process.argv[1]);const p=(s.phases||[]).find(p=>String(p.id)===process.argv[2]);console.log(p?p.status:'missing')" "$STATE" "$1"; }
block_phase() {
  node -e "const f=process.argv[1];const s=require('./'+f);for(const p of s.phases||[])if(String(p.id)===process.argv[2]){p.status='blocked';p.reason=process.argv[3];p.updatedAt=new Date().toISOString()}require('fs').writeFileSync(f,JSON.stringify(s,null,2)+'\n')" "$STATE" "$1" "$2"
  git add "$STATE"; git commit -q -m "chore(standards): phase $1 blocked by the runner - $2"
}
decisions_mark() { if [ -f "$DECISIONS" ]; then git hash-object "$DECISIONS"; else echo none; fi; }
# Prints the session's cost, or the word CRASH when the CLI exited non-zero without a result;
# NOOP:<cost> when the session ended with no commit and no decision recorded.
run_phase() {
  local phase="$1" budget="$2" prompt stamp head_before mark_before
  if [ "$phase" = "wrap-up" ]; then prompt="/adopt-standards --wrap-up"; else prompt="/adopt-standards --phase $phase"; fi
  stamp="$(date +%H%M%S)"; head_before="$(git rev-parse HEAD)"; mark_before="$(decisions_mark)"
  export ADOPTION_RUN=1 ADOPTION_BRANCH="$BRANCH" ADOPTION_BASE="$BASE" ADOPTION_UNTIL="$UNTIL" ADOPTION_PHASE="$phase"
  run_agent "$prompt" "$budget" "adopt-$phase-$DATE" "$NIGHT/phase-$phase-$stamp"
  unset ADOPTION_RUN ADOPTION_BRANCH ADOPTION_BASE ADOPTION_UNTIL ADOPTION_PHASE
  if [ "$R_CRASHED" = "1" ]; then echo CRASH; return 0; fi
  # In -p the starting mode is Manual unless the flag takes effect; if auto mode is unavailable
  # here, every ordinary command is denied and the run "succeeds" doing nothing. Stop instead.
  if [ "$R_DENIALS" -ge 15 ]; then echo "phase $phase: $R_DENIALS permission denials - auto mode is probably unavailable to -p here; rerun with mode dontAsk and explicit allow rules" >&2; exit 3; fi
  if [ "$(git rev-parse HEAD)" = "$head_before" ] && [ "$(decisions_mark)" = "$mark_before" ]; then echo "  no-op session: no commit and no decision recorded" >&2; echo "NOOP:$R_COST"; return 0; fi
  echo "$R_COST"
}

DEADLINE="$(deadline_epoch)"; CRASHES=0; ABORT=""
# A counter file per phase rather than an associative array: macOS ships bash 3, which has none.
SESS_DIR="$NIGHT/sessions"; mkdir -p "$SESS_DIR"
sessions_of() { cat "$SESS_DIR/$1" 2>/dev/null || echo 0; }
noops_of() { cat "$SESS_DIR/$1.noop" 2>/dev/null || echo 0; }
while [ "$(date +%s)" -lt "$DEADLINE" ] && awk "BEGIN{exit !($SPENT < $MAX_COST)}"; do
  NEXT=""
  for id in $PHASES; do s="$(status_of "$id")"; if [ "$s" = "pending" ] || [ "$s" = "in_progress" ]; then NEXT="$id"; break; fi; done
  [ -n "$NEXT" ] || { echo "no phase left to run"; break; }
  if [ "$(sessions_of "$NEXT")" -ge "$MAX_SESSIONS" ]; then
    WHY="still $(status_of "$NEXT") after $MAX_SESSIONS sessions"; [ "$(noops_of "$NEXT")" -gt 0 ] && WHY="$WHY ($(noops_of "$NEXT") no-op)"
    block_phase "$NEXT" "$WHY"; continue
  fi
  assert_harness_untouched "before phase $NEXT" || { ABORT="harness moved before phase $NEXT"; break; }
  BUDGET="$(awk "BEGIN{b=$MAX_COST-$SPENT; print (b<5)?5:b}")"
  COST="$(run_phase "$NEXT" "$BUDGET")"
  if [ "$COST" = "CRASH" ]; then
    # Not a session: nothing was decided about the phase. One retry covers a transient start
    # failure; a second crash in a row is the environment, not the phase.
    CRASHES=$((CRASHES + 1))
    [ "$CRASHES" -lt 2 ] || { ABORT="agent failed to run twice in a row (exit without a result); fix the environment, then rerun"; break; }
    continue
  fi
  CRASHES=0
  echo "$(( $(sessions_of "$NEXT") + 1 ))" > "$SESS_DIR/$NEXT"
  case "$COST" in NOOP:*) echo "$(( $(noops_of "$NEXT") + 1 ))" > "$SESS_DIR/$NEXT.noop"; COST="${COST#NOOP:}";; esac
  SPENT="$(awk "BEGIN{print $SPENT+$COST}")"
  echo "  spent so far: $SPENT USD"
done

if [ -z "$ABORT" ] && awk "BEGIN{exit !($SPENT < $MAX_COST)}"; then
  if assert_harness_untouched "before the wrap-up"; then
    COST="$(run_phase wrap-up "$(awk "BEGIN{b=$MAX_COST-$SPENT; print (b<5)?5:b}")")"
    case "$COST" in CRASH) COST=0;; NOOP:*) COST="${COST#NOOP:}";; esac
    SPENT="$(awk "BEGIN{print $SPENT+$COST}")"
  else ABORT="harness moved before the wrap-up"; fi
fi

# Push only what the morning can trust: the harness identical to the base, nothing loosened
# against it without a decision naming it.
PUSHED=""
if [ -z "${NO_PUSH:-}" ] && [ -z "$ABORT" ]; then
  set +e; node .claude/hooks/check-direction.mjs --base "$BASE" > "$NIGHT/direction.txt" 2>&1; DIRECTION=$?; set -e
  sed 's/^/  /' "$NIGHT/direction.txt"
  if [ -n "$(git diff --name-only "$BASE" -- .claude/)" ]; then echo "branch kept local: the harness (.claude/) differs from $BASE"
  elif [ "$DIRECTION" -eq 2 ]; then echo "branch kept local: something was loosened against $BASE without a decision naming it (above)"
  else git push -u origin "$BRANCH"; PUSHED=1; fi
fi
if [ -n "$ABORT" ]; then echo "night-run ABORTED: $SPENT USD on $BRANCH (not pushed) - $ABORT"; else echo "night-run done: $SPENT USD on $BRANCH${PUSHED:+ (pushed)}"; fi
echo "read: docs/ADOPTION_REPORT_$DATE.md, $DECISIONS, $STATE, $NIGHT/"
git log --oneline "$BASE..$BRANCH"
[ -z "$ABORT" ] || exit 2
