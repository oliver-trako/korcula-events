param(
  [string]$SourceCheckSummary,
  [string]$PendingPath = "site/data/pending-events.json",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

if (-not $SourceCheckSummary) {
  throw "Pass -SourceCheckSummary pointing to tmp/source-checks/<run>/summary.json."
}

$summary = Get-Content -Raw -Path $SourceCheckSummary | ConvertFrom-Json
$pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json

function Get-CandidateSignature {
  param($SourceUrl, $DateHints, $TimeHints, $KeywordHits)
  $parts = @(
    [string]$SourceUrl
    (@($DateHints) -join "|")
    (@($TimeHints) -join "|")
    (@($KeywordHits) -join "|")
  )
  return ($parts -join "::").ToLowerInvariant()
}

$existingSignatures = @{}
foreach ($candidate in @($pendingDoc.candidates)) {
  $evidence = $candidate.evidence
  $signature = Get-CandidateSignature `
    -SourceUrl $candidate.sourceUrl `
    -DateHints @($evidence.dateHints) `
    -TimeHints @($evidence.timeHints) `
    -KeywordHits @($evidence.keywordHits)
  $existingSignatures[$signature] = $true
}

$newCandidates = @()

foreach ($row in $summary | Where-Object { $_.status -eq "fetched" }) {
  $text = if ($row.textPath -and (Test-Path -LiteralPath $row.textPath)) {
    Get-Content -Raw -LiteralPath $row.textPath
  } else {
    [string]$row.textSnippet
  }

  $dateHints = if ($row.PSObject.Properties.Name -contains "dateHints") {
    @($row.dateHints)
  } else {
    @([regex]::Matches($text, '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b') | Select-Object -First 20 | ForEach-Object { $_.Value })
  }
  $timeHints = if ($row.PSObject.Properties.Name -contains "timeHints") {
    @($row.timeHints)
  } else {
    @([regex]::Matches($text, '\b([01]?\d|2[0-3])[:.](\d{2})\b') | Select-Object -First 20 | ForEach-Object { $_.Value })
  }

  if ($dateHints.Count -eq 0 -and $timeHints.Count -eq 0 -and @($row.keywordHits).Count -eq 0) {
    continue
  }

  $signature = Get-CandidateSignature `
    -SourceUrl $row.url `
    -DateHints @($dateHints) `
    -TimeHints @($timeHints) `
    -KeywordHits @($row.keywordHits)
  if ($existingSignatures.ContainsKey($signature)) {
    continue
  }

  $candidateId = "candidate-" + ([guid]::NewGuid().ToString("n").Substring(0, 12))
  $newCandidates += [pscustomobject]@{
    id = $candidateId
    status = "needs-review"
    discoveredAt = (Get-Date).ToString("s")
    sourceId = $row.sourceId
    sourceName = $row.sourceName
    sourceUrl = $row.url
    evidence = @{
      keywordHits = @($row.keywordHits)
      dateHints = @($dateHints)
      timeHints = @($timeHints)
      pageTitle = $row.pageTitle
      textSnippet = $row.textSnippet
      contentLength = $row.contentLength
      textPath = $row.textPath
    }
    event = $null
    notes = if ($dateHints.Count -gt 0 -or $timeHints.Count -gt 0) {
      "Review extracted evidence and create event object before approval."
    } else {
      "Source page matched keywords but no date/time was extracted. Review source manually before approval."
    }
  }
  $existingSignatures[$signature] = $true
}

if ($newCandidates.Count -gt 0 -and -not $WhatIf) {
  $pendingDoc.candidates += $newCandidates
  $pendingDoc | ConvertTo-Json -Depth 20 | Set-Content -Path $PendingPath -Encoding UTF8
}

Write-Host "Candidate extraction complete:"
Write-Host "  New candidates: $($newCandidates.Count)"
Write-Host "  Pending file:   $PendingPath"
if ($WhatIf) {
  Write-Host "  WhatIf: no files changed"
}
