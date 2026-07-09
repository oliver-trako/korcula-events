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
