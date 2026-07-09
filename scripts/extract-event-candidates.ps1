param(
  [string]$SourceCheckSummary,
  [string]$PendingPath = "site/data/pending-events.json"
)

$ErrorActionPreference = "Stop"

if (-not $SourceCheckSummary) {
  throw "Pass -SourceCheckSummary pointing to tmp/source-checks/<run>/summary.json."
}

$summary = Get-Content -Raw -Path $SourceCheckSummary | ConvertFrom-Json
$pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json

$newCandidates = @()

foreach ($row in $summary | Where-Object { $_.status -eq "fetched" }) {
  $text = if ($row.textPath -and (Test-Path -LiteralPath $row.textPath)) {
    Get-Content -Raw -LiteralPath $row.textPath
  } else {
    ""
  }

  $dateHints = [regex]::Matches($text, '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b') | Select-Object -First 20 | ForEach-Object { $_.Value }
  $timeHints = [regex]::Matches($text, '\b([01]?\d|2[0-3])[:.](\d{2})\b') | Select-Object -First 20 | ForEach-Object { $_.Value }

  if ($dateHints.Count -eq 0 -and $timeHints.Count -eq 0 -and @($row.keywordHits).Count -eq 0) {
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
      textPath = $row.textPath
    }
    event = $null
    notes = "Review source text and create event object before approval."
  }
}

if ($newCandidates.Count -gt 0) {
  $pendingDoc.candidates += $newCandidates
  $pendingDoc | ConvertTo-Json -Depth 20 | Set-Content -Path $PendingPath -Encoding UTF8
}

Write-Host "Candidate extraction complete:"
Write-Host "  New candidates: $($newCandidates.Count)"
Write-Host "  Pending file:   $PendingPath"
