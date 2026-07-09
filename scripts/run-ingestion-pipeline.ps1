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

$sourceSummary = Join-Path $env:TEMP "korcula-source-checks/summary.json"

if ($CheckSources) {
  $args = @("-File", "scripts/check-sources.ps1", "-Priority", $Priority)
  if ($Limit -gt 0) { $args += @("-Limit", [string]$Limit) }
  powershell -NoProfile -ExecutionPolicy Bypass @args
}

if ($ExtractCandidates) {
  if (-not (Test-Path -LiteralPath $sourceSummary)) {
    throw "Source summary not found: $sourceSummary. Run with -CheckSources first."
  }
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-event-candidates.ps1 -SourceCheckSummary $sourceSummary
}

if ($Classify) {
  $args = @("-File", "scripts/classify-pending-events.ps1")
  if ($WhatIf) { $args += "-WhatIf" }
  powershell -NoProfile -ExecutionPolicy Bypass @args
}

if ($MergeApproved) {
  $args = @("-File", "scripts/merge-approved-events.ps1")
  if ($WhatIf) { $args += "-WhatIf" }
  powershell -NoProfile -ExecutionPolicy Bypass @args
}

Write-Host "Ingestion pipeline complete."
