param(
  [string]$Name = "agnes-live",
  [string]$BaseDir = ".worktree",
  [int]$IntervalSeconds = 2,
  [switch]$NoBuild,
  [switch]$KeepArtifacts,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
  throw "watch-worktree.ps1 must run inside a Git repository"
}

$syncScript = Join-Path $repoRoot "scripts/sync-worktree.ps1"
if (-not (Test-Path -LiteralPath $syncScript)) {
  throw "Missing sync script: $syncScript"
}

function Get-SourceFingerprint {
  $head = (& git -C $repoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "git rev-parse HEAD failed"
  }

  $status = (& git -C $repoRoot status --porcelain=v1 -z) -join ""
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed"
  }

  return "$head`n$status"
}

function Invoke-Sync {
  $args = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $syncScript,
    "-Name",
    $Name,
    "-BaseDir",
    $BaseDir
  )

  if ($NoBuild) {
    $args += "-NoBuild"
  }
  if ($KeepArtifacts) {
    $args += "-KeepArtifacts"
  }

  & pwsh @args
  if ($LASTEXITCODE -ne 0) {
    throw "worktree sync failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Watching source repo for isolated worktree sync. Press Ctrl+C to stop."
Invoke-Sync
$lastFingerprint = Get-SourceFingerprint

if ($Once) {
  exit 0
}

while ($true) {
  Start-Sleep -Seconds $IntervalSeconds
  $fingerprint = Get-SourceFingerprint
  if ($fingerprint -eq $lastFingerprint) {
    continue
  }

  Write-Host "Source changes detected. Syncing isolated worktree..."
  Invoke-Sync
  $lastFingerprint = Get-SourceFingerprint
}
