param(
  [string]$EventsPath = "site/data/events.json",
  [string]$PendingPath = "site/data/pending-events.json",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$eventsDoc = Get-Content -Raw -Path $EventsPath | ConvertFrom-Json
$pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json

function Set-ObjectProperty {
  param($Object, [string]$Name, $Value)
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  } else {
    $prop.Value = $Value
  }
}

function Normalize-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  $normalized = $Text.ToLowerInvariant().Normalize([System.Text.NormalizationForm]::FormD)
  $chars = foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      $char
    }
  }
  return ((-join $chars) -replace '[^a-z0-9]+', ' ').Trim()
}

function Get-TokenSet {
  param([string]$Text)
  $ignore = @("the","and","or","in","at","of","for","with","by","a","an","kino","concert","koncert","festival","event","events","korcula","korcula")
  $tokens = Normalize-Text $Text -split '\s+' | Where-Object { $_.Length -gt 2 -and $_ -notin $ignore }
  $set = @{}
  foreach ($token in $tokens) { $set[$token] = $true }
  return $set
}

function Get-JaccardScore {
  param($Left, $Right)
  if (-not $Left -or -not $Right) { return 0 }
  $union = @{}
  $intersection = 0
  foreach ($key in $Left.Keys) { $union[$key] = $true }
  foreach ($key in $Right.Keys) {
    if ($Left.ContainsKey($key)) { $intersection++ }
    $union[$key] = $true
  }
  if ($union.Count -eq 0) { return 0 }
  return [Math]::Round($intersection / $union.Count, 3)
}

function Get-TokenOverlapCount {
  param($Left, $Right)
  if (-not $Left -or -not $Right) { return 0 }
  $count = 0
  foreach ($key in $Left.Keys) {
    if ($Right.ContainsKey($key)) { $count++ }
  }
  return $count
}

function Get-EventTitle {
  param($Event)
  if ($null -eq $Event) { return "" }
  return [string]($Event.en, $Event.hr, $Event.id | Where-Object { $_ } | Select-Object -First 1)
}

function Test-FuzzyDuplicate {
  param($CandidateEvent, $ExistingEvents)
  if ($null -eq $CandidateEvent -or -not $CandidateEvent.date) { return $false }
  $candidateTitle = Get-EventTitle $CandidateEvent
  $candidateTokens = Get-TokenSet $candidateTitle
  $candidateTitleNorm = Normalize-Text $candidateTitle
  $candidateVenue = Normalize-Text ([string]$CandidateEvent.venue)
  foreach ($existing in $ExistingEvents) {
    if (-not $existing.date) { continue }
    $sameDate = [string]$existing.date -eq [string]$CandidateEvent.date
    $candidateEnd = if ($CandidateEvent.endDate) { [string]$CandidateEvent.endDate } else { [string]$CandidateEvent.date }
    $existingEnd = if ($existing.endDate) { [string]$existing.endDate } else { [string]$existing.date }
    $rangeOverlap = ([string]$existing.date -le $candidateEnd) -and ([string]$CandidateEvent.date -le $existingEnd)
    if (-not ($sameDate -or $rangeOverlap)) { continue }
    $score = if ($sameDate) { 0.30 } else { 0.18 }
    $sameTown = $CandidateEvent.town -and $existing.town -and [string]$CandidateEvent.town -eq [string]$existing.town
    if ($sameTown) { $score += 0.15 }
    $sameTime = $CandidateEvent.time -and $existing.time -and [string]$CandidateEvent.time -eq [string]$existing.time
    if ($sameTime) { $score += 0.15 }
    $existingVenue = Normalize-Text ([string]$existing.venue)
    $venueMatch = $false
    if ($candidateVenue -and $existingVenue) {
      if ($candidateVenue -eq $existingVenue) {
        $venueMatch = $true
        $score += 0.18
      } elseif ($candidateVenue.Length -ge 6 -and $existingVenue.Length -ge 6 -and ($candidateVenue.Contains($existingVenue) -or $existingVenue.Contains($candidateVenue))) {
        $venueMatch = $true
        $score += 0.12
      }
    }
    $existingTitle = Get-EventTitle $existing
    $existingTokens = Get-TokenSet $existingTitle
    $titleScore = Get-JaccardScore $candidateTokens $existingTokens
    $titleOverlap = Get-TokenOverlapCount $candidateTokens $existingTokens
    $existingTitleNorm = Normalize-Text $existingTitle
    $exactTitle = $candidateTitleNorm -and $candidateTitleNorm -eq $existingTitleNorm
    $strongTitle = $exactTitle -or $titleScore -ge 0.50 -or ($titleScore -ge 0.34 -and $titleOverlap -ge 2)
    $score += [Math]::Min(0.35, [double]($titleScore * 0.35))
    $isLikelyDuplicate = (
      ($sameDate -and $strongTitle -and ($venueMatch -or $sameTime -or $sameTown -or $titleScore -ge 0.70)) -or
      ($sameDate -and $venueMatch -and $sameTime) -or
      ($rangeOverlap -and -not $sameDate -and $strongTitle -and ($venueMatch -or $sameTown))
    )
    if ($score -ge 0.62 -and $isLikelyDuplicate) { return $true }
  }
  return $false
}

$existingIds = @{}
foreach ($event in $eventsDoc.events) {
  $existingIds[[string]$event.id] = $true
}

$approved = @($pendingDoc.candidates | Where-Object { $_.status -eq "approved" -and $_.event })
$toMerge = @()
$skipped = @()

foreach ($candidate in $approved) {
  $event = $candidate.event
  if (-not $event.id) {
    $skipped += [pscustomobject]@{ candidateId = $candidate.id; reason = "approved candidate missing event.id" }
    continue
  }
  if ($existingIds.ContainsKey([string]$event.id)) {
    $skipped += [pscustomobject]@{ candidateId = $candidate.id; eventId = $event.id; reason = "event id already exists" }
    continue
  }
  if ([string]$candidate.duplicateRisk -eq "high" -or (Test-FuzzyDuplicate -CandidateEvent $event -ExistingEvents $eventsDoc.events)) {
    Set-ObjectProperty $candidate "status" "needs-review"
    Set-ObjectProperty $candidate "reviewMode" "human-review"
    $skipped += [pscustomobject]@{ candidateId = $candidate.id; eventId = $event.id; reason = "possible fuzzy duplicate" }
    continue
  }
  $toMerge += $event
}

if ($WhatIf -or $toMerge.Count -eq 0) {
  Write-Host "Approved candidates: $($approved.Count)"
  if ($WhatIf) {
    Write-Host "Would merge:         $($toMerge.Count)"
    Write-Host "Would skip:          $($skipped.Count)"
  } else {
    Write-Host "Merged:              0"
    Write-Host "Skipped:             $($skipped.Count)"
  }
  if ($skipped.Count) { $skipped | Format-Table -AutoSize }
  exit 0
}

foreach ($event in $toMerge) {
  $eventsDoc.events += $event
}

$eventsDoc.events = @($eventsDoc.events | Sort-Object date, time, id)

foreach ($candidate in $pendingDoc.candidates) {
  if ($candidate.status -eq "approved" -and $candidate.event -and -not $existingIds.ContainsKey([string]$candidate.event.id)) {
    Set-ObjectProperty $candidate "status" "merged"
    Set-ObjectProperty $candidate "mergedAt" (Get-Date).ToString("s")
  }
}

$eventsDoc | ConvertTo-Json -Depth 20 | Set-Content -Path $EventsPath -Encoding UTF8
$pendingDoc | ConvertTo-Json -Depth 20 | Set-Content -Path $PendingPath -Encoding UTF8

Write-Host "Merge complete:"
Write-Host "  Merged:  $($toMerge.Count)"
Write-Host "  Skipped: $($skipped.Count)"
