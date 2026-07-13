param(
  [string]$PendingPath = "site/data/pending-events.json",
  [string]$SourcesPath = "site/data/sources.json",
  [string]$EventsPath = "site/data/events.json",
  [string]$PolicyPath = "site/data/ingestion-policy.json",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Has-FieldValue {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return $false }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $false }
  if ($null -eq $prop.Value) { return $false }
  if ($prop.Value -is [string] -and [string]::IsNullOrWhiteSpace($prop.Value)) { return $false }
  if ($Name -eq "cats" -and @($prop.Value).Count -eq 0) { return $false }
  return $true
}

function Add-Reason {
  param([System.Collections.Generic.List[string]]$Reasons, [string]$Reason)
  if (-not $Reasons.Contains($Reason)) { [void]$Reasons.Add($Reason) }
}

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

function Get-FuzzyDuplicateMatches {
  param($CandidateEvent, $ExistingEvents)
  if ($null -eq $CandidateEvent -or -not $CandidateEvent.date) { return @() }

  $candidateTitle = Get-EventTitle $CandidateEvent
  $candidateTokens = Get-TokenSet $candidateTitle
  $candidateVenue = Normalize-Text ([string]$CandidateEvent.venue)
  $candidateTown = [string]$CandidateEvent.town
  $candidateTime = [string]$CandidateEvent.time

  $matches = @()
  foreach ($existing in $ExistingEvents) {
    if (-not $existing.date) { continue }
    $sameDate = [string]$existing.date -eq [string]$CandidateEvent.date
    $rangeOverlap = $existing.endDate -and ([string]$existing.date -le [string]$CandidateEvent.date) -and ([string]$CandidateEvent.date -le [string]$existing.endDate)
    if (-not ($sameDate -or $rangeOverlap)) { continue }

    $score = 0.0
    $reasons = [System.Collections.Generic.List[string]]::new()
    if ($sameDate) { $score += 0.30; [void]$reasons.Add("same date") }
    elseif ($rangeOverlap) { $score += 0.18; [void]$reasons.Add("date within existing range") }

    if ($candidateTown -and $existing.town -and [string]$existing.town -eq $candidateTown) {
      $score += 0.15
      [void]$reasons.Add("same town")
    }

    $categoryOverlap = $false
    foreach ($cat in @($CandidateEvent.cats)) {
      if ($cat -and $cat -in @($existing.cats)) {
        $categoryOverlap = $true
        break
      }
    }
    if ($categoryOverlap) {
      [void]$reasons.Add("overlapping category")
    }

    $existingTime = [string]$existing.time
    if ($candidateTime -and $existingTime -and $candidateTime -eq $existingTime) {
      $score += 0.15
      [void]$reasons.Add("same time")
    }

    $existingVenue = Normalize-Text ([string]$existing.venue)
    if ($candidateVenue -and $existingVenue) {
      if ($candidateVenue -eq $existingVenue) {
        $score += 0.20
        [void]$reasons.Add("same venue")
      } elseif ($candidateVenue.Contains($existingVenue) -or $existingVenue.Contains($candidateVenue)) {
        $score += 0.12
        [void]$reasons.Add("similar venue")
      }
    }

    $titleScore = Get-JaccardScore $candidateTokens (Get-TokenSet (Get-EventTitle $existing))
    if ($titleScore -gt 0) {
      $score += [Math]::Min(0.35, [double]($titleScore * 0.35))
      if ($titleScore -ge 0.45) { [void]$reasons.Add("similar title") }
    }

    $score = [Math]::Round([Math]::Min(1.0, [double]$score), 3)
    if ($score -ge 0.58 -and ($titleScore -ge 0.18 -or $categoryOverlap)) {
      $matches += [pscustomobject]@{
        eventId = $existing.id
        title = Get-EventTitle $existing
        date = $existing.date
        time = $existing.time
        venue = $existing.venue
        score = $score
        reasons = @($reasons)
      }
    }
  }

  return @($matches | Sort-Object score -Descending | Select-Object -First 5)
}

$pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json
$sourcesDoc = Get-Content -Raw -Path $SourcesPath | ConvertFrom-Json
$eventsDoc = Get-Content -Raw -Path $EventsPath | ConvertFrom-Json
$policyDoc = Get-Content -Raw -Path $PolicyPath | ConvertFrom-Json

$sourceById = @{}
foreach ($source in $sourcesDoc.sources) {
  $sourceById[[string]$source.id] = $source
}

$existingIds = @{}
foreach ($event in $eventsDoc.events) {
  $existingIds[[string]$event.id] = $true
}

$autoApproved = 0
$needsReview = 0
$unchanged = 0

foreach ($candidate in $pendingDoc.candidates) {
  if ($candidate.status -notin @("new", "needs-review", "auto-review")) {
    $unchanged++
    continue
  }

  $reasons = [System.Collections.Generic.List[string]]::new()
  $source = $null
  if ($candidate.sourceId -and $sourceById.ContainsKey([string]$candidate.sourceId)) {
    $source = $sourceById[[string]$candidate.sourceId]
  } else {
    Add-Reason $reasons "unknown sourceId"
  }

  $event = $candidate.event
  if ($null -eq $event) {
    Add-Reason $reasons "candidate has no structured event object"
  }

  if ($source) {
    if ([string]$source.type -notin @($policyDoc.autoPublish.allowedSourceTypes)) {
      Add-Reason $reasons "source type requires review: $($source.type)"
    }
    if ([string]$source.confidence -notin @($policyDoc.autoPublish.requiredSourceConfidence)) {
      Add-Reason $reasons "source confidence is not high: $($source.confidence)"
    }
  }

  if ($candidate.scrapeMode -and [string]$candidate.scrapeMode -notin @($policyDoc.autoPublish.allowedScrapeModes)) {
    Add-Reason $reasons "scrape mode requires review: $($candidate.scrapeMode)"
  }

  if ($candidate.kind -and [string]$candidate.kind -in @($policyDoc.autoPublish.blockedCandidateKinds)) {
    Add-Reason $reasons "candidate kind requires review: $($candidate.kind)"
  }

  if ($event) {
    foreach ($field in $policyDoc.autoPublish.requiredEventFields) {
      if (-not (Has-FieldValue $event ([string]$field))) {
        Add-Reason $reasons "missing required event field: $field"
      }
    }

    if ($policyDoc.autoPublish.blockedIfVerifyTrue -and $event.verify -eq $true) {
      Add-Reason $reasons "event is marked verify:true"
    }

    if ($policyDoc.autoPublish.blockedIfDuplicateId -and $event.id -and $existingIds.ContainsKey([string]$event.id)) {
      Add-Reason $reasons "duplicate event id: $($event.id)"
    }

    $duplicateMatches = @(Get-FuzzyDuplicateMatches -CandidateEvent $event -ExistingEvents $eventsDoc.events)
    if ($duplicateMatches.Count -gt 0) {
      Set-ObjectProperty $candidate "duplicateRisk" "high"
      Set-ObjectProperty $candidate "duplicateMatches" $duplicateMatches
      Add-Reason $reasons "possible duplicate of existing event: $($duplicateMatches[0].eventId) ($($duplicateMatches[0].score))"
    } else {
      Set-ObjectProperty $candidate "duplicateRisk" "low"
      Set-ObjectProperty $candidate "duplicateMatches" @()
    }

    if ($policyDoc.autoPublish.blockedIfDateAmbiguous -and $event.time -match 'tbc|varies|evening|morning|afternoon') {
      Add-Reason $reasons "ambiguous event time"
    }
  }

  if ($reasons.Count -eq 0) {
    Set-ObjectProperty $candidate "status" "approved"
    Set-ObjectProperty $candidate "reviewMode" "auto-approved"
    Set-ObjectProperty $candidate "reviewedAt" (Get-Date).ToString("s")
    Set-ObjectProperty $candidate "reviewNotes" "Auto-approved by ingestion policy."
    $autoApproved++
  } else {
    Set-ObjectProperty $candidate "status" "needs-review"
    Set-ObjectProperty $candidate "reviewMode" "human-review"
    Set-ObjectProperty $candidate "reviewReasons" @($reasons)
    $needsReview++
  }
}

if (-not $WhatIf) {
  $pendingDoc | ConvertTo-Json -Depth 30 | Set-Content -Path $PendingPath -Encoding UTF8
}

Write-Host "Classification complete:"
Write-Host "  Auto-approved: $autoApproved"
Write-Host "  Needs review:  $needsReview"
Write-Host "  Unchanged:     $unchanged"
if ($WhatIf) {
  Write-Host "  WhatIf: no files changed"
}
