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
