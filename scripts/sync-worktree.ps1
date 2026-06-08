param(
  [string]$Name = "agnes-live",
  [string]$BaseDir = ".worktree",
  [switch]$NoBuild,
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [string]$WorkingDirectory = $repoRoot,
    [string]$InputText
  )

  $previous = Get-Location
  try {
    Set-Location -LiteralPath $WorkingDirectory
    if ($PSBoundParameters.ContainsKey("InputText")) {
      $InputText | & git @Args
    } else {
      & git @Args
    }
    if ($LASTEXITCODE -ne 0) {
      throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Set-Location $previous
  }
}

function Get-RelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$From,
    [Parameter(Mandatory = $true)]
    [string]$To
  )
  return [System.IO.Path]::GetRelativePath((Resolve-Path -LiteralPath $From), (Resolve-Path -LiteralPath $To))
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
  throw "sync-worktree.ps1 must run inside a Git repository"
}

$basePath = if ([System.IO.Path]::IsPathRooted($BaseDir)) {
  $BaseDir
} else {
  Join-Path $repoRoot $BaseDir
}
$targetPath = Join-Path $basePath $Name

New-Item -ItemType Directory -Force -Path $basePath | Out-Null
Invoke-Git -Args @("worktree", "prune")

function Normalize-PathForCompare {
  param([Parameter(Mandatory = $true)][string]$Path)
  $full = [System.IO.Path]::GetFullPath($Path)
  return $full.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).ToLowerInvariant()
}

$targetComparePath = Normalize-PathForCompare -Path $targetPath
$registeredWorktreePaths = & git worktree list --porcelain |
  Where-Object { $_ -like "worktree *" } |
  ForEach-Object { $_.Substring("worktree ".Length) } |
  ForEach-Object { Normalize-PathForCompare -Path $_ }
$targetIsRegistered = $registeredWorktreePaths -contains $targetComparePath

if ((Test-Path -LiteralPath $targetPath) -and -not $targetIsRegistered) {
  throw "Target exists but is not a registered Git worktree: $targetPath"
}

if (-not $targetIsRegistered) {
  Invoke-Git -Args @("worktree", "add", "--detach", $targetPath, "HEAD")
}

Invoke-Git -Args @("reset", "--hard", "HEAD") -WorkingDirectory $targetPath
Invoke-Git -Args @("clean", "-fdx", "--", ".") -WorkingDirectory $targetPath

$head = (& git rev-parse HEAD).Trim()
Invoke-Git -Args @("checkout", "--detach", $head) -WorkingDirectory $targetPath

$patchPath = [System.IO.Path]::GetTempFileName()
try {
  Invoke-Git -Args @("diff", "--binary", "HEAD", "--output", $patchPath)
  if ((Get-Item -LiteralPath $patchPath).Length -gt 0) {
    Invoke-Git -Args @("apply", "--binary", $patchPath) -WorkingDirectory $targetPath
  }
} finally {
  if (Test-Path -LiteralPath $patchPath) {
    Remove-Item -LiteralPath $patchPath -Force
  }
}

$untracked = & git ls-files --others --exclude-standard -z
if ($untracked) {
  $files = ($untracked -join "") -split "`0" | Where-Object { $_ }
  foreach ($file in $files) {
    $source = Join-Path $repoRoot $file
    $destination = Join-Path $targetPath $file
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

if (-not $KeepArtifacts) {
  $artifactPaths = @(
    (Join-Path $targetPath ".agnes"),
    (Join-Path $targetPath ".isolated-home"),
    (Join-Path $targetPath "LIVE_AUTODELEGATE_SENTINEL.txt"),
    (Join-Path $targetPath "LIVE_AUTODELEGATE_ISOLATED_SENTINEL.txt"),
    (Join-Path $targetPath "LIVE_AUTODELEGATE_HOME_ISOLATED_SENTINEL.txt")
  )
  foreach ($artifactPath in $artifactPaths) {
    if (Test-Path -LiteralPath $artifactPath) {
      Remove-Item -LiteralPath $artifactPath -Recurse -Force
    }
  }
}

if (-not $NoBuild) {
  $previous = Get-Location
  try {
    Set-Location -LiteralPath $targetPath
    & bun run bundle
    if ($LASTEXITCODE -ne 0) {
      throw "bun run bundle failed with exit code $LASTEXITCODE"
    }
  } finally {
    Set-Location $previous
  }
}

$relativeTarget = Get-RelativePath -From $repoRoot -To $targetPath
Write-Host "Synced isolated worktree: $relativeTarget"
Write-Host "Base commit: $head"
Write-Host "Included tracked staged/unstaged changes and untracked non-ignored files."
if (-not $NoBuild) {
  Write-Host "Built plugin bundle in target worktree."
}
