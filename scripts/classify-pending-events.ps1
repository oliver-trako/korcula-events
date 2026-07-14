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

function Test-EvidenceSupportsTown {
  param($Candidate, [string]$Town)
  if (-not $Town) { return $true }
  $text = Normalize-Text ([string]$Candidate.evidence.textSnippet)
  if (-not $text) { return $false }
  $townTerms = @{
    "racisce" = @("racisce", "raciscu")
    "korcula" = @("korcula", "koreula")
    "lumbarda" = @("lumbarda")
    "vela-luka" = @("vela luka")
    "blato" = @("blato", "blatsko")
    "smokvica" = @("smokvica", "brna")
    "orebic" = @("orebic")
    "kneze" = @("kneze")
    "zrnovo" = @("zrnovo", "postrana")
    "pupnat" = @("pupnat")
    "cara" = @("cara")
  }
  if (-not $townTerms.ContainsKey($Town)) { return $true }
  foreach ($term in $townTerms[$Town]) {
    if ($text.Contains($term)) { return $true }
  }
  return $false
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
  $aliases = @{
    theodor = "theodore"
    theodors = "theodore"
    todor = "theodore"
    todora = "theodore"
    festivity = "feast"
    festivities = "feast"
    workshops = "workshop"
    programming = "program"
  }
  $tokens = (Normalize-Text $Text) -split '\s+' | ForEach-Object {
    if ($aliases.ContainsKey($_)) { $aliases[$_] } else { $_ }
  } | Where-Object { $_.Length -gt 2 -and $_ -notin $ignore -and $_ -notmatch '^(19|20)\d{2}$' }
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
  return [string](@($Event.en, $Event.hr, $Event.id) | Where-Object { $_ } | Select-Object -First 1)
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
    $candidateEnd = if ($CandidateEvent.endDate) { [string]$CandidateEvent.endDate } else { [string]$CandidateEvent.date }
    $existingEnd = if ($existing.endDate) { [string]$existing.endDate } else { [string]$existing.date }
    $rangeOverlap = ([string]$existing.date -le $candidateEnd) -and ([string]$CandidateEvent.date -le $existingEnd)
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
      $score += 0.08
      [void]$reasons.Add("overlapping category")
    }

    $existingTime = [string]$existing.time
    $sameTime = $false
    if ($candidateTime -and $existingTime -and $candidateTime -eq $existingTime) {
      $sameTime = $true
      $score += 0.15
      [void]$reasons.Add("same time")
    }

    $existingVenue = Normalize-Text ([string]$existing.venue)
    $venueMatch = $false
    if ($candidateVenue -and $existingVenue) {
      if ($candidateVenue -eq $existingVenue) {
        $venueMatch = $true
        $score += 0.20
        [void]$reasons.Add("same venue")
      } elseif ($candidateVenue.Length -ge 6 -and $existingVenue.Length -ge 6 -and ($candidateVenue.Contains($existingVenue) -or $existingVenue.Contains($candidateVenue))) {
        $venueMatch = $true
        $score += 0.12
        [void]$reasons.Add("similar venue")
      }
    }

    $existingTitle = Get-EventTitle $existing
    $existingTokens = Get-TokenSet $existingTitle
    $titleScore = Get-JaccardScore $candidateTokens $existingTokens
    $titleOverlap = Get-TokenOverlapCount $candidateTokens $existingTokens
    $candidateTitleNorm = Normalize-Text $candidateTitle
    $existingTitleNorm = Normalize-Text $existingTitle
    $exactTitle = $candidateTitleNorm -and $candidateTitleNorm -eq $existingTitleNorm
    $strongTitle = $exactTitle -or $titleScore -ge 0.50 -or ($titleScore -ge 0.34 -and $titleOverlap -ge 2)
    if ($titleScore -gt 0) {
      $score += [Math]::Min(0.35, [double]($titleScore * 0.35))
      if ($strongTitle) { [void]$reasons.Add("similar title") }
    }

    $score = [Math]::Round([Math]::Min(1.0, [double]$score), 3)
    $isLikelyDuplicate = (
      ($sameDate -and $strongTitle -and ($venueMatch -or $sameTime -or ([string]$existing.town -eq $candidateTown) -or $titleScore -ge 0.70)) -or
      ($sameDate -and $venueMatch -and $sameTime) -or
      ($rangeOverlap -and -not $sameDate -and $strongTitle -and ($venueMatch -or ([string]$existing.town -eq $candidateTown)))
    )

    if ($score -ge 0.62 -and $isLikelyDuplicate) {
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
$autoRejected = 0
$autoDuplicate = 0
$needsReview = 0
$unchanged = 0
$today = (Get-Date).ToString("yyyy-MM-dd")

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
    if ($source -and $source.town -and [string]$source.town -notin @("island-wide", "") -and $event.town -and [string]$event.town -eq [string]$source.town) {
      if (-not (Test-EvidenceSupportsTown -Candidate $candidate -Town ([string]$event.town))) {
        Add-Reason $reasons "event town is inferred from source but not supported by evidence text: $($event.town)"
      }
    }

    $eventEnd = if ($event.endDate) { [string]$event.endDate } else { [string]$event.date }
    if ($policyDoc.autoPublish.autoRejectPastEvents -and $eventEnd -and $eventEnd -lt $today) {
      Set-ObjectProperty $candidate "status" "rejected"
      Set-ObjectProperty $candidate "reviewMode" "auto-rejected"
      Set-ObjectProperty $candidate "reviewedAt" (Get-Date).ToString("s")
      Set-ObjectProperty $candidate "reviewReasons" @("event date is in the past")
      $autoRejected++
      continue
    }

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

      $bestDuplicate = $duplicateMatches[0]
      $bestReasons = @($bestDuplicate.reasons)
      $sameOrSimilarVenue = ("same venue" -in $bestReasons) -or ("similar venue" -in $bestReasons)
      $sameTime = "same time" -in $bestReasons
      $sameDaySameSlot = ("same date" -in $bestReasons) -and ("same town" -in $bestReasons) -and ("overlapping category" -in $bestReasons) -and $sameTime -and $sameOrSimilarVenue
      $seasonCoverage = ("date within existing range" -in $bestReasons) -and ("similar title" -in $bestReasons)
      $sameDayStrongMatch = ("same date" -in $bestReasons) -and ($sameOrSimilarVenue -or $sameTime) -and [double]$bestDuplicate.score -ge 0.78
      $sameDayTownStrongTitle = ("same date" -in $bestReasons) -and ("same town" -in $bestReasons) -and ("similar title" -in $bestReasons) -and [double]$bestDuplicate.score -ge 0.68

      if ($seasonCoverage -or $sameDayStrongMatch -or $sameDaySameSlot -or $sameDayTownStrongTitle) {
        Set-ObjectProperty $candidate "status" "duplicate"
        Set-ObjectProperty $candidate "reviewMode" "auto-duplicate"
        Set-ObjectProperty $candidate "reviewedAt" (Get-Date).ToString("s")
        Set-ObjectProperty $candidate "reviewReasons" @("high-confidence duplicate of existing event: $($bestDuplicate.eventId) ($($bestDuplicate.score))")
        $autoDuplicate++
        continue
      }
    } else {
      Set-ObjectProperty $candidate "duplicateRisk" "low"
      Set-ObjectProperty $candidate "duplicateMatches" @()
    }

    if ($candidate.sourceId -eq "visit-korcula" -and ([string]$event.venue -in @("Korcula", "Racisce", "Lumbarda", "Vela Luka", "Orebic", "Smokvica / Brna"))) {
      Add-Reason $reasons "official event listing has only a default venue"
    }

    if ($candidate.sourceId -eq "visit-korcula" -and -not (Has-FieldValue $event "time")) {
      Add-Reason $reasons "official event listing has no event time"
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
Write-Host "  Auto-rejected: $autoRejected"
Write-Host "  Auto-duplicate: $autoDuplicate"
Write-Host "  Needs review:  $needsReview"
Write-Host "  Unchanged:     $unchanged"
if ($WhatIf) {
  Write-Host "  WhatIf: no files changed"
}
