param(
  [switch]$CheckSources,
  [switch]$ExtractCandidates,
  [switch]$Classify,
  [switch]$MergeApproved,
  [switch]$WhatIf,
  [string]$Priority = "high",
  [int]$Limit = 0
)

$ErrorActionPreference = "Stop"

if (-not ($CheckSources -or $ExtractCandidates -or $Classify -or $MergeApproved)) {
  $CheckSources = $true
  $ExtractCandidates = $true
  $Classify = $true
  $MergeApproved = $true
}

$tempRoot = if ($env:TEMP) { $env:TEMP } elseif ($env:TMPDIR) { $env:TMPDIR } else { [System.IO.Path]::GetTempPath() }
$sourceSummary = Join-Path $tempRoot "korcula-source-checks/summary.json"
$scriptDir = $PSScriptRoot

if ($CheckSources) {
  $checkArgs = @{ Priority = $Priority }
  if ($Limit -gt 0) { $checkArgs.Limit = $Limit }
  & (Join-Path $scriptDir "check-sources.ps1") @checkArgs
}

if ($ExtractCandidates) {
  if (-not (Test-Path -LiteralPath $sourceSummary)) {
    throw "Source summary not found: $sourceSummary. Run with -CheckSources first."
  }
  $extractArgs = @{ SourceCheckSummary = $sourceSummary }
  if ($WhatIf) { $extractArgs.WhatIf = $true }
  & (Join-Path $scriptDir "extract-event-candidates.ps1") @extractArgs
}

if ($Classify) {
  $classifyArgs = @{}
  if ($WhatIf) { $classifyArgs.WhatIf = $true }
  & (Join-Path $scriptDir "classify-pending-events.ps1") @classifyArgs
}

if ($MergeApproved) {
  $mergeArgs = @{}
  if ($WhatIf) { $mergeArgs.WhatIf = $true }
  & (Join-Path $scriptDir "merge-approved-events.ps1") @mergeArgs
}

Write-Host "Ingestion pipeline complete."
