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
  $candidateVenue = Normalize-Text ([string]$CandidateEvent.venue)
  foreach ($existing in $ExistingEvents) {
    if ([string]$existing.date -ne [string]$CandidateEvent.date) { continue }
    $score = 0.30
    if ($CandidateEvent.town -and $existing.town -and [string]$CandidateEvent.town -eq [string]$existing.town) { $score += 0.15 }
    if ($CandidateEvent.time -and $existing.time -and [string]$CandidateEvent.time -eq [string]$existing.time) { $score += 0.15 }
    $existingVenue = Normalize-Text ([string]$existing.venue)
    if ($candidateVenue -and $existingVenue -and ($candidateVenue -eq $existingVenue -or $candidateVenue.Contains($existingVenue) -or $existingVenue.Contains($candidateVenue))) { $score += 0.18 }
    $categoryOverlap = $false
    foreach ($cat in @($CandidateEvent.cats)) {
      if ($cat -and $cat -in @($existing.cats)) { $categoryOverlap = $true; break }
    }
    $titleScore = Get-JaccardScore $candidateTokens (Get-TokenSet (Get-EventTitle $existing))
    $score += [Math]::Min(0.35, [double]($titleScore * 0.35))
    if ($score -ge 0.58 -and ($titleScore -ge 0.18 -or $categoryOverlap)) { return $true }
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
