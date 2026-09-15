<#
.SYNOPSIS
  Drive the adoption programme unattended: one the agent session per phase on a dedicated
  branch, until the hour or the budget runs out. Windows PowerShell 5.1 compatible.

.EXAMPLE
  .\night-run.ps1 -Repo C:\path\to\repo -Until 07:00 -MaxCostUsd 80
  .\night-run.ps1 -Repo . -Until 06:30 -MaxCostUsd 40 -Phases 7,8 -Model opus -Effort high
  .\night-run.ps1 -Repo . -CanaryOnly          # prove the flags and the hooks in a real -p session, nothing else

.NOTES
  Requires the agent >= 2.1.259 (--permission-prompts none). The project must carry
  .claude/settings.json (hooks), .claude/adoption.json, .claude/hooks/*.mjs and
  .claude/skills/adopt-standards/SKILL.md from the package's templates/harness/.
  User-level hooks do not run in -p; the project's do. defaultMode in settings never applies
  to -p either: the mode is passed on the command line here.

  Before the first phase the runner proves four things or refuses the night: the harness
  self-test is green, .claude/ is identical to the base branch, the gate is green on the branch
  as it starts, and a CANARY session - a real `the agent's headless mode` under the night flags - ran a command
  through auto mode, was refused a `--no-verify` commit by the guard, had its stop judged
  by the Stop hook, and saw no MCP tool but the ones .claude/mcp.night.json names. Every one
  of those was a way a night could "succeed" doing nothing - or doing something elsewhere.

  Every session runs with --strict-mcp-config: the mail, chat and drive connectors of the user
  settings do not exist at night. A repository that wants an MCP server at night (a code
  server such as Serena) declares it in .claude/mcp.night.json AND in adoption.json ->
  mcpServers; protect.mjs denies every other server's tools.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $Repo,
  [string] $Until = "07:00",
  [double] $MaxCostUsd = 60,
  [int[]] $Phases,
  [string] $Model = "opus",
  [ValidateSet("low", "medium", "high", "xhigh")] [string] $Effort = "high",
  [ValidateSet("auto", "dontAsk")] [string] $Mode = "auto",
  [switch] $NoPush,
  # The canary costs a dollar and two minutes; skip it only for a repository it already passed on today.
  [switch] $SkipCanary,
  # Run the pre-flight (self-test, harness untouched, gate, canary) on the CURRENT branch and stop.
  [switch] $CanaryOnly,
  # The executable to drive. Override with a stub (templates/agent/testing/stub-agent.mjs)
  # to exercise the whole loop, state handling and bookkeeping without spending a session.
  # The agent's executable: this parameter, else ABATTY_AGENT, else agent.command in
  # ~/.abatty/config.json. Never a default in the repository.
  [string] $AgentCommand = ""
)

# "Continue", not "Stop": under Stop, Windows PowerShell 5.1 turns ANY stderr line of a native
# command (git saying "Already on 'branch'", a warning agent prints) into a terminating error
# that ends the night. Failures are judged on exit codes instead, explicitly, after each call.
$ErrorActionPreference = "Continue"
Set-Location $Repo
if (-not $AgentCommand) { $AgentCommand = $env:ABATTY_AGENT }
if (-not $AgentCommand) {
  $cfgPath = Join-Path $HOME ".abatty\config.json"
  if (Test-Path $cfgPath) { try { $AgentCommand = (Get-Content $cfgPath -Raw | ConvertFrom-Json).agent.command } catch {} }
}
if (-not $AgentCommand) { throw "No agent command: pass -AgentCommand, set ABATTY_AGENT, or write { \"agent\": { \"command\": \"...\" } } to ~/.abatty/config.json" }
function Assert-LastExit([string] $what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }
# Out-File -Encoding utf8 writes a BOM in Windows PowerShell 5.1, and JSON.parse in the hooks
# refuses it: the state file the runner writes would block every stop as "unreadable".
function Write-Utf8NoBom([string] $path, [string] $text) { [IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $path -Parent)).Path + [IO.Path]::DirectorySeparatorChar + (Split-Path $path -Leaf), $text, (New-Object Text.UTF8Encoding $false)) }
$inv = [Globalization.CultureInfo]::InvariantCulture

# ---- guards ---------------------------------------------------------------------------------
$dirty = git status --porcelain
if ($dirty) { throw ("Working tree is dirty. Commit or stash before an unattended run:`n" + ($dirty -join "`n")) }
git fetch --prune 2>&1 | Out-Null

$config = Get-Content ".claude/adoption.json" -Raw | ConvertFrom-Json
$base = if ($config.baseBranch) { $config.baseBranch } else { "main" }
$prefix = if ($config.branchPrefix) { $config.branchPrefix } else { "adopt/standards" }
$stateFile = if ($config.files.state) { $config.files.state } else { "docs/ADOPTION_STATE.json" }
$decisionsFile = if ($config.files.decisions) { $config.files.decisions } else { "docs/ADOPTION_DECISIONS.md" }
$gateCmd = if ($config.commands.gate) { $config.commands.gate } else { "npm run gate:fast" }
$maxSessions = if ($config.maxSessionsPerPhase) { [int]$config.maxSessionsPerPhase } else { 2 }
if (-not $Phases) { $Phases = @($config.phases | ForEach-Object { [int]$_ }) }

# ---- the branch -----------------------------------------------------------------------------
$date = Get-Date -Format "yyyy-MM-dd"
$branch = "$prefix-$date"
if ($CanaryOnly) {
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
} else {
  $exists = git branch --list $branch
  if ($exists) {
    git checkout -q $branch 2>&1 | Out-Null; Assert-LastExit "checkout $branch"
  } else {
    # The LOCAL base branch when it exists: it is what carries a harness that is committed but
    # not pushed yet. Branching from origin/<base> would start a night without the hooks.
    $localBase = git branch --list $base
    if ($localBase) { git checkout -q -b $branch $base 2>&1 | Out-Null } else { git checkout -q -b $branch "origin/$base" 2>&1 | Out-Null }
    Assert-LastExit "create $branch"
  }
}
# The harness must be ON THIS BRANCH: project hooks only run from the checkout that runs.
foreach ($needed in @(".claude/settings.json", ".claude/adoption.json", ".claude/hooks/stop-gate.mjs", ".claude/hooks/guard.mjs", ".claude/hooks/protect.mjs", ".claude/hooks/check-direction.mjs", ".claude/skills/adopt-standards/SKILL.md")) {
  if (-not (Test-Path $needed)) { throw "Harness incomplete on $branch - missing $needed. Commit the templates on $base first." }
}
# The harness proves itself before it is trusted: guard and stop-gate against known inputs, the
# wiring in settings.json and adoption.json, the the agent version. Red means no night.
& node .claude/hooks/self-test.mjs
if ($LASTEXITCODE -ne 0) { throw "Harness self-test failed. Fix the harness before running unattended." }

# The hooks that judge the night are the ones a human committed on the base: identical, or no
# night. Checked again before every session and before the push - a session that reached the
# Stop cap with the harness edited would otherwise be followed by sessions judged by its edit.
function Assert-HarnessUntouched([string] $when) {
  $moved = @(git diff --name-only $base -- .claude/ | Where-Object { $_ })
  if ($moved.Count -gt 0) {
    throw ("The harness (.claude/) differs from $base $when :`n" + ($moved -join "`n") + "`nA night runs on the hooks a human committed. Restore them (git checkout $base -- .claude/) or commit the change on $base first; if the repository's Prettier reformats them, format them on $base or add .claude/ to .prettierignore.")
  }
}
Assert-HarnessUntouched "at the start"

# ---- run bookkeeping ------------------------------------------------------------------------
$nightDir = ".claude/night/$date"
New-Item -ItemType Directory -Force $nightDir | Out-Null
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
Write-Utf8NoBom ".claude/night/run.json" (@{ startedAt = $startedAt; branch = $branch; base = $base; until = $Until; maxCostUsd = $MaxCostUsd } | ConvertTo-Json)

# ---- the MCP servers a session may have at all ----------------------------------------------
# --strict-mcp-config with this file is the only reason a -p session does not carry every MCP
# server of the user settings (Gmail, Slack, Drive... with send, create and delete tools no hook
# sees). The committed .claude/mcp.night.json when the repository has one - it is under
# .claude/, so read-only to the worker and identical to the base or no night - else an empty one
# written here. The canary checks the session's own tool list against its server names.
$mcpConfig = if (Test-Path ".claude/mcp.night.json") { (Resolve-Path ".claude/mcp.night.json").Path } else {
  Write-Utf8NoBom "$nightDir/mcp-none.json" '{"mcpServers":{}}'
  (Resolve-Path "$nightDir/mcp-none.json").Path
}
$mcpServers = @()
try { $mcpServers = @(((Get-Content $mcpConfig -Raw | ConvertFrom-Json).mcpServers.PSObject.Properties | ForEach-Object { $_.Name })) } catch { throw "$mcpConfig does not parse as an MCP config" }
$mcpAllowed = @($config.mcpServers | Where-Object { $_ })
foreach ($srv in $mcpServers) { if ($mcpAllowed -notcontains $srv) { throw "$mcpConfig loads the MCP server '$srv' but adoption.json -> mcpServers does not name it: every call to it would be denied. Name it in both, or in neither." } }
Write-Host ("MCP at night: {0} ({1})" -f $(if ($mcpServers.Count) { $mcpServers -join ", " } else { "none" }), $mcpConfig)

# ---- pre-flight: the gate is green before anything is asked of the model -------------------
# A red gate at the start is not the phase's doing; it would block every stop until the cap and
# be read as a blocked phase in the morning. Run it once here, on the branch as it starts.
Write-Host ("[{0}] pre-flight: {1}" -f (Get-Date -Format "HH:mm"), $gateCmd)
# The redirection belongs to cmd, not to PowerShell: a PowerShell `>` writes UTF-16 in 5.1 and
# the tail read back as UTF-8 is one garbled character per byte.
$preflightLog = (Resolve-Path $nightDir).Path + "\preflight-gate.txt"
cmd /c "$gateCmd > `"$preflightLog`" 2>&1"
if ($LASTEXITCODE -ne 0) {
  $tail = (Get-Content $preflightLog -Tail 25) -join "`n"
  throw "The gate is red on $branch before the night started ($gateCmd). Fix it by day; a night cannot.`n$tail"
}

function Set-NightEnv([string] $phaseArg) {
  $env:ADOPTION_RUN = "1"
  $env:ADOPTION_BRANCH = $branch
  $env:ADOPTION_BASE = $base
  $env:ADOPTION_UNTIL = $Until
  # A [string] parameter turns $null into "": an empty phase means "no phase" (the canary).
  if ([string]::IsNullOrEmpty($phaseArg)) { Remove-Item Env:ADOPTION_PHASE -ErrorAction SilentlyContinue } else { $env:ADOPTION_PHASE = $phaseArg }
}
function Clear-NightEnv { Remove-Item Env:ADOPTION_RUN, Env:ADOPTION_BRANCH, Env:ADOPTION_BASE, Env:ADOPTION_UNTIL, Env:ADOPTION_PHASE -ErrorAction SilentlyContinue }

# One `the agent's headless mode` under the night flags. Returns @{ exit; parsed; json; cost; denials; crashed; detail }.
function Invoke-Agent([string] $prompt, [double] $budget, [string] $name, [string] $outBase) {
  $out = "$outBase.json"
  $err = "$outBase.stderr.txt"
  # Not `$args`: that name is PowerShell's automatic argument array. And not `& agent 2> file`:
  # under $ErrorActionPreference = "Stop", Windows PowerShell 5.1 wraps a native command's stderr
  # lines in NativeCommandError and would abort the whole night on the first warning agent prints.
  $agentArgs = @(
    "-p", ('"' + $prompt + '"'),
    "--permission-mode", $Mode,
    "--permission-prompts", "none",
    "--output-format", "json",
    "--max-budget-usd", $budget.ToString("0.00", $inv),
    "--model", $Model,
    "--effort", $Effort,
    "--strict-mcp-config", "--mcp-config", ('"' + $mcpConfig + '"'),
    "-n", $name
  )
  Write-Host ("[{0}] {1}: agent {2}" -f (Get-Date -Format "HH:mm"), $name, ($agentArgs -join " "))
  $agentExe = (Get-Command $AgentCommand).Source
  $proc = Start-Process -FilePath $agentExe -ArgumentList $agentArgs -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err
  $r = @{ exit = $proc.ExitCode; parsed = $false; json = $null; cost = 0.0; denials = 0; crashed = $false; detail = "" }
  try {
    $raw = Get-Content $out -Raw
    if ($raw -and $raw.Trim()) {
      $r.json = $raw | ConvertFrom-Json
      $r.parsed = $true
      if ($r.json.total_cost_usd) { $r.cost = [double]$r.json.total_cost_usd }
      if ($r.json.permission_denials) { $r.denials = @($r.json.permission_denials).Count }
      if ($r.json.is_error) { Write-Host "  session reported an error: $($r.json.result)" }
    }
  } catch { Write-Host "  could not parse $out" }
  Write-Host ("  exit {0}, cost {1} USD, {2} permission denial(s)" -f $r.exit, $r.cost.ToString("0.00", $inv), $r.denials)
  # A process that exits non-zero WITHOUT a result is not a session that worked and stopped: it
  # is the CLI failing to run (a bad flag, no login, a crash on startup). Counting it as a session
  # would mark the phase "blocked after N sessions" and hide the real cause under a wrong reason.
  if ($r.exit -ne 0 -and -not $r.parsed) {
    $r.detail = if (Test-Path $err) { (Get-Content $err -Tail 12 -Encoding UTF8) -join "`n" } else { "(no stderr)" }
    $r.crashed = $true
    Write-Host "  the session did not produce a result. stderr:`n$($r.detail)"
  }
  return $r
}

# ---- pre-flight: the canary session ---------------------------------------------------------
# The stub night proves the runner, the self-test proves the hooks; neither proves that a real
# `the agent's headless mode` under these flags runs a command without a prompt, that the guard fires inside it,
# or that the Stop hook does. Three tool calls and a one-word answer prove all three, for about
# a dollar, before a night is spent finding out.
function Invoke-Canary {
  Set-NightEnv ""
  $head = (git rev-parse --short HEAD).Trim()
  $startedCanary = (Get-Date).ToUniversalTime()
  $prompt = "Canary for the night harness. Do exactly these three things with the Bash tool and nothing else. First, run: git rev-parse --short HEAD. Second, run: git commit --allow-empty --no-verify -m canary - a hook must refuse it; if it is refused, do not retry it in any other form and do not work around it. Third, reply with the short hash printed by the first command, then one space, then the names of every tool available to you whose name starts with mcp__ separated by commas, or the single word none if there is no such tool. Nothing else."
  $r = Invoke-Agent $prompt 2.0 "adopt-canary-$date" "$nightDir/canary"
  $failed = @()
  if ($r.crashed) { $failed += "the CLI produced no result (exit $($r.exit)): $($r.detail)" }
  elseif ($r.json.is_error) { $failed += "the session reported an error: $($r.json.result)" }
  else {
    $answer = if ($r.json.result) { ([string]$r.json.result).Trim() } else { "" }
    $words = @($answer -split "\s+" | Where-Object { $_ })
    $hashAnswer = if ($words.Count) { $words[0] } else { "" }
    if ($hashAnswer -ne $head) { $failed += "a Bash command did not run through auto mode without a prompt (expected the answer to start with '$head', got '$answer'; $($r.denials) denial(s) - if many, auto mode is unavailable to -p here: rerun with -Mode dontAsk)" }
    # The session's own account of its MCP tools against the servers the night declares: a
    # server it has that is not declared means --strict-mcp-config did not take; a declared
    # server with no tool means it did not start. "none" and no declared server is the usual.
    $mcpReported = @()
    if ($words.Count -gt 1) { $mcpReported = @(($words[1..($words.Count - 1)] -join " ") -split "[,\s]+" | Where-Object { $_ -and $_ -ne "none" }) }
    if ($words.Count -lt 2) { $failed += "the canary did not report its MCP tools (answer '$answer'): whether --strict-mcp-config took is unproven" }
    $norm = { param($x) ($x -replace "[^A-Za-z0-9_]", "_") }
    $declared = @($mcpServers | ForEach-Object { & $norm $_ })
    $seen = @($mcpReported | ForEach-Object { if ($_ -match "^mcp__(.+?)__") { $Matches[1] } else { $_ } } | Sort-Object -Unique)
    foreach ($srv in $seen) { if ($declared -notcontains $srv) { $failed += "the session has MCP tools from '$srv' which $mcpConfig does not declare: --strict-mcp-config did not take, and the user's connectors would act at night with no hook watching" } }
    foreach ($srv in $declared) { if ($seen -notcontains $srv) { $failed += "the declared MCP server '$srv' gave the session no tool: it did not start (read $nightDir/canary.stderr.txt)" } }
    $last = (git log -1 --format=%s).Trim()
    if ($last -eq "canary") {
      git reset -q --hard HEAD~1 2>&1 | Out-Null
      $failed += "the PreToolUse guard did NOT run: the --no-verify commit landed (removed again). Hooks from .claude/settings.json are not firing in -p sessions here."
    }
    $denialLog = ".claude/night/guard-denials.jsonl"
    $logged = $false
    if (Test-Path $denialLog) {
      foreach ($line in Get-Content $denialLog -Encoding UTF8) {
        try { $d = $line | ConvertFrom-Json; if ($d.command -match "no-verify" -and ([DateTime]$d.at).ToUniversalTime() -ge $startedCanary.AddSeconds(-5)) { $logged = $true } } catch {}
      }
    }
    if (-not $logged -and $last -ne "canary") { $failed += "the guard left no denial in $denialLog for the --no-verify commit: the model may not have attempted it, so the guard is unproven (read $nightDir/canary.json)" }
    $sid = if ($r.json.session_id) { [string]$r.json.session_id } else { "" }
    $receipt = ".claude/night/stop-gate-$sid.json"
    if (-not $sid -or -not (Test-Path $receipt)) { $failed += "the Stop hook left no receipt ($receipt): it did not run in this -p session" }
    else {
      $rc = Get-Content $receipt -Raw | ConvertFrom-Json
      if ($rc.decision -ne "allow") { $failed += "the Stop hook did run but did not allow the stop: decision '$($rc.decision)', reason: $($rc.reason)" }
      if ($rc.configSource -ne "base") { $failed += "the Stop hook read adoption.json from the tree, not from $base (configSource '$($rc.configSource)')" }
    }
    $dirtyAfter = git status --porcelain | Where-Object { $_ -and $_ -notmatch "\.claude/night/" }
    if ($dirtyAfter) { $failed += ("the canary left the tree dirty:`n" + ($dirtyAfter -join "`n")) }
  }
  Clear-NightEnv
  if ($failed.Count -gt 0) {
    throw ("Canary failed - the night would not have been what it claims. " + $failed.Count + " finding(s):`n- " + ($failed -join "`n- ") + "`nRead $nightDir/canary.json and $nightDir/canary.stderr.txt.")
  }
  Write-Host ("  canary ok: a command ran without a prompt, the guard refused --no-verify, the Stop hook allowed the stop reading adoption.json from {0}, MCP servers seen: {1} ({2} USD)" -f $base, $(if ($seen.Count) { $seen -join ", " } else { "none" }), $r.cost.ToString("0.00", $inv))
  return $r.cost
}

$spent = 0.0
if (-not $SkipCanary) { $spent += Invoke-Canary }
if ($CanaryOnly) {
  Remove-Item ".claude/night/run.json" -ErrorAction SilentlyContinue
  Write-Host ("pre-flight done on {0}: self-test green, harness identical to {1}, gate green, canary green. {2} USD." -f $branch, $base, $spent.ToString("0.00", $inv))
  exit 0
}

if (-not (Test-Path $stateFile)) {
  # @(...) is load-bearing: a pipeline with ONE phase unwraps to a bare hashtable, and
  # ConvertTo-Json then writes "phases": {...} instead of an array. Every hook reads
  # phases.find(...) and would report the file unreadable until the block cap.
  $phaseObjs = @($Phases | ForEach-Object { @{ id = $_; status = "pending" } })
  New-Item -ItemType Directory -Force (Split-Path $stateFile -Parent) | Out-Null
  Write-Utf8NoBom $stateFile ((@{ startedAt = $startedAt; baseBranch = $base; phases = $phaseObjs } | ConvertTo-Json -Depth 5) + "`n")
  # Read it back the way the hooks will, before it is committed and trusted for a night.
  & node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); if (!Array.isArray(s.phases) || s.phases.length === 0 || !s.startedAt) { console.error('state file: phases must be a non-empty array with startedAt'); process.exit(1); }" $stateFile
  if ($LASTEXITCODE -ne 0) { throw "The runner wrote an invalid $stateFile - refusing to start on it." }
  git add $stateFile 2>&1 | Out-Null
  git commit -q -m "chore(standards): open the adoption state for $date" 2>&1 | Out-Null; Assert-LastExit "commit state file"
}

Start-Transcript -Path "$nightDir/transcript.txt" -Append | Out-Null
Write-Host "night-run: branch $branch, base $base, until $Until, budget $MaxCostUsd USD, mode $Mode"

# ---- helpers ---------------------------------------------------------------------------------
function Get-Deadline {
  $t = [DateTime]::ParseExact($Until, "HH:mm", $null)
  $d = (Get-Date).Date.AddHours($t.Hour).AddMinutes($t.Minute)
  if ($d -le (Get-Date)) { $d = $d.AddDays(1) }
  return $d
}
function Read-State { return (Get-Content $stateFile -Raw | ConvertFrom-Json) }
function Get-PhaseStatus([int] $id) {
  $p = (Read-State).phases | Where-Object { [int]$_.id -eq $id }
  if ($p) { return $p.status } else { return "missing" }
}
function Set-PhaseBlocked([int] $id, [string] $reason) {
  $state = Read-State
  foreach ($p in $state.phases) {
    if ([int]$p.id -eq $id) {
      $p | Add-Member -NotePropertyName status -NotePropertyValue "blocked" -Force
      $p | Add-Member -NotePropertyName reason -NotePropertyValue $reason -Force
      $p | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString("o")) -Force
    }
  }
  Write-Utf8NoBom $stateFile (($state | ConvertTo-Json -Depth 6) + "`n")
  git add $stateFile 2>&1 | Out-Null
  git commit -q -m "chore(standards): phase $id blocked by the runner - $reason" 2>&1 | Out-Null
}
function Get-DecisionsMark { if (Test-Path $decisionsFile) { return (Get-FileHash $decisionsFile -Algorithm SHA1).Hash } else { return "none" } }

function Invoke-Phase([string] $phaseArg, [double] $budget) {
  Set-NightEnv $phaseArg
  $prompt = if ($phaseArg -eq "wrap-up") { "/adopt-standards --wrap-up" } else { "/adopt-standards --phase $phaseArg" }
  $stamp = Get-Date -Format "HHmmss"
  $headBefore = (git rev-parse HEAD).Trim()
  $decisionsBefore = Get-DecisionsMark
  $r = Invoke-Agent $prompt $budget "adopt-$phaseArg-$date" "$nightDir/phase-$phaseArg-$stamp"
  if ($r.crashed) { return @{ cost = 0.0; crashed = $true; noop = $false; detail = $r.detail } }
  # In -p the starting mode is Manual unless the flag takes effect. If auto mode is unavailable
  # to this session, every ordinary command is denied and the run "succeeds" doing nothing.
  if ($r.denials -ge 15) {
    throw "Phase $phaseArg saw $($r.denials) permission denials: auto mode is probably unavailable to -p sessions here. Stop, and rerun with -Mode dontAsk plus explicit allow rules in .claude/settings.json."
  }
  # A session that ended with no commit and no decision did nothing the morning can read. It is
  # counted as a session (it ran), and named, so a phase blocked after two of them says why.
  $noop = ((git rev-parse HEAD).Trim() -eq $headBefore) -and ((Get-DecisionsMark) -eq $decisionsBefore)
  if ($noop) { Write-Host "  no-op session: no commit and no decision recorded" }
  return @{ cost = $r.cost; crashed = $false; noop = $noop; detail = "" }
}

# ---- the loop --------------------------------------------------------------------------------
$deadline = Get-Deadline
$sessions = @{}
$noops = @{}
$crashes = 0
$abort = ""
try {
  while ((Get-Date) -lt $deadline -and $spent -lt $MaxCostUsd) {
    $next = $null
    foreach ($id in $Phases) {
      $s = Get-PhaseStatus $id
      if ($s -eq "pending" -or $s -eq "in_progress") { $next = $id; break }
    }
    if ($null -eq $next) { Write-Host "no phase left to run"; break }
    if (-not $sessions.ContainsKey($next)) { $sessions[$next] = 0; $noops[$next] = 0 }
    if ($sessions[$next] -ge $maxSessions) {
      $why = "still $(Get-PhaseStatus $next) after $maxSessions sessions"
      if ($noops[$next] -gt 0) { $why += " ($($noops[$next]) no-op)" }
      Set-PhaseBlocked $next $why
      continue
    }
    Assert-HarnessUntouched "before phase $next"
    $remainingBudget = [Math]::Max(5.0, $MaxCostUsd - $spent)
    $r = Invoke-Phase ([string]$next) $remainingBudget
    if ($r.crashed) {
      # Not a session: nothing was decided about the phase. One retry covers a transient start
      # failure; a second crash in a row is the environment, and a night on it would be a loop
      # of nothing until the deadline.
      $crashes++
      if ($crashes -ge 2) { throw "agent failed to run twice in a row (exit without a result). Fix the environment, then rerun.`n$($r.detail)" }
      continue
    }
    $crashes = 0
    $sessions[$next]++
    if ($r.noop) { $noops[$next]++ }
    $spent += $r.cost
  }

  # ---- wrap-up -------------------------------------------------------------------------------
  if ($spent -lt $MaxCostUsd) {
    Assert-HarnessUntouched "before the wrap-up"
    $r = Invoke-Phase "wrap-up" ([Math]::Max(5.0, $MaxCostUsd - $spent))
    if ($r.crashed) { Write-Host "wrap-up did not run: $($r.detail)" }
    $spent += $r.cost
  }
} catch {
  $abort = $_.Exception.Message
  Write-Host "night aborted: $abort"
} finally {
  Clear-NightEnv
}

# ---- push, only what the morning can trust -------------------------------------------------
$pushed = $false
if (-not $NoPush -and -not $abort) {
  $moved = @(git diff --name-only $base -- .claude/ | Where-Object { $_ })
  $directionLog = (Resolve-Path $nightDir).Path + "\direction.txt"
  cmd /c "node .claude/hooks/check-direction.mjs --base $base > `"$directionLog`" 2>&1"
  $directionExit = $LASTEXITCODE
  Get-Content $directionLog | ForEach-Object { "  $_" }
  if ($moved.Count -gt 0) { Write-Host "branch kept local: the harness (.claude/) differs from $base" }
  elseif ($directionExit -eq 2) { Write-Host "branch kept local: something was loosened against $base without a decision naming it (above)" }
  else {
    git push -u origin $branch 2>&1 | ForEach-Object { "$_" }; Assert-LastExit "push $branch"
    $pushed = $true
  }
}

Write-Host ""
Write-Host ("night-run {0}: {1} USD, branch {2}{3}" -f $(if ($abort) { "ABORTED" } else { "done" }), $spent.ToString("0.00", $inv), $branch, $(if ($pushed) { " (pushed)" } elseif ($NoPush) { " (not pushed, -NoPush)" } else { " (NOT pushed)" }))
if ($abort) { Write-Host "reason: $abort" }
Write-Host "read: docs/ADOPTION_REPORT_$date.md, docs/ADOPTION_DECISIONS.md, $stateFile, $nightDir/"
git log --oneline "$base..$branch"
Stop-Transcript | Out-Null
if ($abort) { exit 2 }
