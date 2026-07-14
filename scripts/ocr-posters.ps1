param(
  [string]$PosterDir = "2026 Events",
  [string]$OutPath = "site/data/poster-ocr-report.json",
  [string]$PendingPath = "site/data/pending-events.json",
  [string]$EventsPath = "site/data/events.json",
  [switch]$CreateCandidates,
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Ensure-Dir {
  param([string]$Path)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

function Write-JsonFile {
  param([string]$Path, $Value)
  Ensure-Dir $Path
  $json = $Value | ConvertTo-Json -Depth 20
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $Path)).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $Path), $json + [Environment]::NewLine, $utf8NoBom)
}

function Get-RelativePath {
  param([string]$BasePath, [string]$Path)
  $base = (Resolve-Path -LiteralPath $BasePath).Path
  $full = (Resolve-Path -LiteralPath $Path).Path
  $baseUri = [System.Uri]::new(($base.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar))
  $fullUri = [System.Uri]::new($full)
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fullUri).ToString()).Replace('\', '/')
}

function Get-ShortHash {
  param([string]$Text)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash) -replace '-', '').Substring(0, 12).ToLowerInvariant()
  } finally {
    $sha.Dispose()
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
  $ignore = @("the","and","or","in","at","of","for","with","by","a","an","korcula","koreula","ljeto","lito","summer","event","events","program")
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

function Get-OcrDuplicateMatches {
  param([string]$CandidateId, [string]$Text, $DateHints, $TimeHints, $ExistingCandidates)
  $tokens = Get-TokenSet $Text
  if ($tokens.Count -lt 4) { return @() }
  $matches = @()
  foreach ($existing in @($ExistingCandidates)) {
    if ([string]$existing.id -eq $CandidateId -or [string]$existing.kind -ne "ocr" -or -not $existing.evidence) { continue }
    $existingText = [string]$existing.evidence.textSnippet
    $existingTokens = Get-TokenSet $existingText
    if ($existingTokens.Count -lt 4) { continue }
    $textScore = Get-JaccardScore $tokens $existingTokens
    $dateOverlap = @($DateHints | Where-Object { $_ -and $_ -in @($existing.evidence.dateHints) }).Count -gt 0
    $timeOverlap = @($TimeHints | Where-Object { $_ -and $_ -in @($existing.evidence.timeHints) }).Count -gt 0
    $score = $textScore
    if ($dateOverlap) { $score += 0.15 }
    if ($timeOverlap) { $score += 0.10 }
    $score = [Math]::Round([Math]::Min(1.0, [double]$score), 3)
    if ($textScore -ge 0.65 -or ($textScore -ge 0.45 -and ($dateOverlap -or $timeOverlap))) {
      $matches += [pscustomobject]@{
        candidateId = $existing.id
        imagePath = $existing.evidence.imagePath
        score = $score
        reasons = @(
          "similar OCR text"
          if ($dateOverlap) { "shared date hint" }
          if ($timeOverlap) { "shared time hint" }
        )
      }
    }
  }
  return @($matches | Sort-Object score -Descending | Select-Object -First 5)
}

function Convert-DateHint {
  param([string]$Hint, [int]$DefaultYear = 2026)
  if (-not $Hint) { return $null }
  $match = [regex]::Match($Hint, '^\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*$')
  if (-not $match.Success) { return $null }
  $day = [int]$match.Groups[1].Value
  $month = [int]$match.Groups[2].Value
  $year = if ($match.Groups[3].Success) { [int]$match.Groups[3].Value } else { $DefaultYear }
  if ($year -lt 100) { $year += 2000 }
  try {
    return (Get-Date -Year $year -Month $month -Day $day -Hour 0 -Minute 0 -Second 0).ToString("yyyy-MM-dd")
  } catch {
    return $null
  }
}

function Get-DateHints {
  param([string]$Text)
  $matches = [regex]::Matches($Text, '\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b') | ForEach-Object { $_.Value }
  return @($matches | Select-Object -Unique)
}

function Get-TimeHints {
  param([string]$Text)
  $times = @()
  $times += [regex]::Matches($Text, '\b([01]?\d|2[0-3])[:h]([0-5]\d)\b') | ForEach-Object { "{0}:{1}" -f ([int]$_.Groups[1].Value).ToString("00"), $_.Groups[2].Value }
  $times += [regex]::Matches($Text, '\b([7-9]|1\d|2[0-3])\.([0-5]\d)\b') | ForEach-Object { "{0}:{1}" -f ([int]$_.Groups[1].Value).ToString("00"), $_.Groups[2].Value }
  $times += [regex]::Matches($Text, '\b([01]\d|2[0-3])([0-5]\d)\b') |
    Where-Object { $_.Value -notmatch '^(19|20)\d{2}$' } |
    ForEach-Object { "{0}:{1}" -f ([int]$_.Groups[1].Value).ToString("00"), $_.Groups[2].Value }
  return @($times | Select-Object -Unique)
}

function Get-TextCategory {
  param([string]$Text)
  $norm = Normalize-Text $Text
  $cats = [System.Collections.Generic.List[string]]::new()
  $rules = [ordered]@{
    film = @("kino","cinema","film","mediteran")
    music = @("koncert","concert","klapa","zbor","folklorna","duo","kvartet","sopran","bariton","gitarski")
    theatre = @("kazalis","kazali","theatre","predstava","stand up","teatar","lutkarska")
    exhibition = @("izlozba","exhibition","slika","crteza","brodogradnja")
    kids = @("djeca","djecu","children","radionica","workshop","mlade","mladi","kadetski")
    folklore = @("moreska","moreska","kumpanjija","mostra","vite")
    food = @("vino","wine","degust","gastr")
    sport = @("turnir","tournament","nogomet","soccer","waterpolo","vaterpolo","kosarka","basketball","buce","bocce")
  }
  foreach ($cat in $rules.Keys) {
    foreach ($term in $rules[$cat]) {
      if ($norm -match "(^| )$([regex]::Escape($term))( |$)") {
        if (-not $cats.Contains($cat)) { [void]$cats.Add($cat) }
        break
      }
    }
  }
  return @($cats)
}

function Get-TextTown {
  param([string]$Text)
  $norm = Normalize-Text $Text
  $towns = [ordered]@{
    "vela-luka" = @("vela luka")
    lumbarda = @("lumbarda")
    blato = @("blato","blatsko")
    smokvica = @("smokvica","brna")
    racisce = @("racisce","raciscu","racisce")
    kneze = @("kneze")
    zavalatica = @("zavalatica")
    cara = @("cara")
    zrnovo = @("zrnovo","postrana")
    korcula = @("korcula","koreula")
  }
  foreach ($town in $towns.Keys) {
    foreach ($term in $towns[$town]) {
      if ($norm.Contains($term)) { return $town }
    }
  }
  return $null
}

function Get-EventTitle {
  param($Event)
  if ($null -eq $Event) { return "" }
  return [string](@($Event.en, $Event.hr, $Event.id) | Where-Object { $_ } | Select-Object -First 1)
}

function Get-PosterEventMatches {
  param([string]$Text, $DateValues, $TimeHints, $Categories, [string]$Town, $ExistingEvents)
  $tokens = Get-TokenSet $Text
  $matches = @()
  foreach ($event in @($ExistingEvents)) {
    if (-not $event.date) { continue }
    $eventStart = [string]$event.date
    $eventEnd = if ($event.endDate) { [string]$event.endDate } else { $eventStart }
    $dateMatch = $false
    foreach ($date in @($DateValues)) {
      if ($date -and $eventStart -le $date -and $date -le $eventEnd) { $dateMatch = $true; break }
    }
    if (-not $dateMatch) { continue }

    $score = 0.35
    $reasons = [System.Collections.Generic.List[string]]::new()
    [void]$reasons.Add("date on poster matches event")

    $eventTime = [string]$event.time
    $timeMatch = $false
    foreach ($time in @($TimeHints)) {
      if ($time -and $eventTime -and $eventTime.Contains($time)) { $timeMatch = $true; break }
    }
    if ($timeMatch) { $score += 0.20; [void]$reasons.Add("time matches") }

    if ($Town -and $event.town -and [string]$event.town -eq $Town) {
      $score += 0.12
      [void]$reasons.Add("town matches")
    }

    $catMatch = $false
    foreach ($cat in @($Categories)) {
      if ($cat -and $cat -in @($event.cats)) { $catMatch = $true; break }
    }
    if ($catMatch) { $score += 0.13; [void]$reasons.Add("category matches") }

    $titleScore = Get-JaccardScore $tokens (Get-TokenSet (Get-EventTitle $event))
    if ($titleScore -gt 0) {
      $score += [Math]::Min(0.25, [double]($titleScore * 0.25))
      if ($titleScore -ge 0.20) { [void]$reasons.Add("title text overlaps") }
    }

    $venueNorm = Normalize-Text ([string]$event.venue)
    if ($venueNorm -and (Normalize-Text $Text).Contains($venueNorm)) {
      $score += 0.15
      [void]$reasons.Add("venue appears in poster text")
    }

    $score = [Math]::Round([Math]::Min(1.0, [double]$score), 3)
    if ($score -ge 0.60 -and ($timeMatch -or $catMatch -or $titleScore -ge 0.20)) {
      $matches += [pscustomobject]@{
        eventId = $event.id
        title = Get-EventTitle $event
        date = $event.date
        time = $event.time
        venue = $event.venue
        score = $score
        reasons = @($reasons)
      }
    }
  }
  return @($matches | Sort-Object score -Descending | Select-Object -First 5)
}

$pendingDoc = $null
$eventsDoc = $null
$existingCandidateIds = @{}
$existingCandidateById = @{}
$existingOcrCandidates = @()
if ($CreateCandidates) {
  $pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json
  if (Test-Path -LiteralPath $EventsPath) {
    $eventsDoc = Get-Content -Raw -Path $EventsPath | ConvertFrom-Json
  }
  foreach ($candidate in @($pendingDoc.candidates)) {
    $existingCandidateIds[[string]$candidate.id] = $true
    $existingCandidateById[[string]$candidate.id] = $candidate
  }
  $existingOcrCandidates = @($pendingDoc.candidates | Where-Object { $_.kind -eq "ocr" })
}

$tesseract = Get-Command tesseract -ErrorAction SilentlyContinue
$images = Get-ChildItem -LiteralPath $PosterDir -File -Recurse |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp|jfif)$' } |
  Sort-Object LastWriteTime

$results = @()

foreach ($img in $images) {
  $relativePath = Get-RelativePath -BasePath (Get-Location).Path -Path $img.FullName
  $candidateId = "candidate-ocr-" + (Get-ShortHash $relativePath)

  if (-not $tesseract) {
    $results += [pscustomobject]@{
      imagePath = $relativePath
      status = "missing-tesseract"
      note = "Install Tesseract OCR locally, then rerun this script. OCR candidates still require review."
    }
    continue
  }

  $base = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
  try {
    & $tesseract.Source $img.FullName $base -l hrv+eng --psm 6 2>$null
    $txtPath = "$base.txt"
    $text = if (Test-Path -LiteralPath $txtPath) { Get-Content -Raw -LiteralPath $txtPath } else { "" }
    $text = ($text -replace '\s+', ' ').Trim()

    $dateHints = @(Get-DateHints $text)
    $dateValues = @($dateHints | ForEach-Object { Convert-DateHint $_ } | Where-Object { $_ } | Select-Object -Unique)
    $timeHints = @(Get-TimeHints $text)
    $categories = @(Get-TextCategory $text)
    $town = Get-TextTown $text
    $textSnippet = if ($text.Length -gt 1200) { $text.Substring(0, 1200) } else { $text }
    $ocrDuplicateMatches = if ($CreateCandidates) { @(Get-OcrDuplicateMatches -CandidateId $candidateId -Text $textSnippet -DateHints $dateHints -TimeHints $timeHints -ExistingCandidates $existingOcrCandidates) } else { @() }
    $eventMatches = if ($eventsDoc) { @(Get-PosterEventMatches -Text $textSnippet -DateValues $dateValues -TimeHints $timeHints -Categories $categories -Town $town -ExistingEvents $eventsDoc.events) } else { @() }
    $strongEventMatch = $eventMatches.Count -gt 0 -and [double]$eventMatches[0].score -ge 0.68
    $allDuplicateMatches = @($eventMatches) + @($ocrDuplicateMatches)
    $duplicateRisk = if ($allDuplicateMatches.Count -gt 0) { "high" } else { "low" }

    $result = [pscustomobject]@{
      imagePath = $relativePath
      candidateId = if ($text) { $candidateId } else { $null }
      status = "ocr-complete"
      textSnippet = $textSnippet
      dateHints = @($dateHints)
      dateValues = @($dateValues)
      timeHints = @($timeHints)
      town = $town
      categories = @($categories)
      duplicateRisk = $duplicateRisk
      duplicateMatches = @($allDuplicateMatches)
      eventMatches = @($eventMatches)
      reviewStatus = if ($strongEventMatch) { "duplicate" } else { "needs-review" }
    }
    $results += $result

    if ($CreateCandidates -and $text) {
      $reviewReasons = @("poster OCR requires human review")
      if ($eventMatches.Count -gt 0) {
        $reviewReasons += "poster appears to match existing event: $($eventMatches[0].eventId) ($($eventMatches[0].score))"
      } elseif ($ocrDuplicateMatches.Count -gt 0) {
        $reviewReasons += "possible duplicate OCR poster: $($ocrDuplicateMatches[0].candidateId) ($($ocrDuplicateMatches[0].score))"
      }

      $candidatePayload = [pscustomobject]@{
        status = if ($strongEventMatch) { "duplicate" } else { "needs-review" }
        evidence = @{
          imagePath = $relativePath
          keywordHits = @()
          dateHints = @($dateHints)
          dateValues = @($dateValues)
          timeHints = @($timeHints)
          town = $town
          categories = @($categories)
          textSnippet = $textSnippet
        }
        event = $null
        notes = "Poster OCR candidate. Review image and OCR text before creating an event."
        duplicateRisk = $duplicateRisk
        duplicateMatches = @($allDuplicateMatches)
        reviewMode = if ($strongEventMatch) { "auto-duplicate" } else { "human-review" }
        reviewReasons = $reviewReasons
      }

      if ($existingCandidateById.ContainsKey($candidateId)) {
        $existing = $existingCandidateById[$candidateId]
        foreach ($prop in $candidatePayload.PSObject.Properties) {
          $current = $existing.PSObject.Properties[$prop.Name]
          if ($current) { $current.Value = $prop.Value }
          else { $existing | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value }
        }
      } else {
        $newCandidate = [pscustomobject]@{
          id = $candidateId
          status = if ($strongEventMatch) { "duplicate" } else { "needs-review" }
          discoveredAt = (Get-Date).ToString("s")
          sourceId = "local-poster-folder"
          sourceName = "Local Poster Folder"
          sourceUrl = $relativePath
          kind = "ocr"
          scrapeMode = "poster-folder"
          evidence = $candidatePayload.evidence
          event = $null
          notes = $candidatePayload.notes
          duplicateRisk = $candidatePayload.duplicateRisk
          duplicateMatches = $candidatePayload.duplicateMatches
          reviewMode = $candidatePayload.reviewMode
          reviewReasons = $candidatePayload.reviewReasons
        }
        $pendingDoc.candidates += $newCandidate
        $existingCandidateIds[$candidateId] = $true
        $existingCandidateById[$candidateId] = $newCandidate
        $existingOcrCandidates += $newCandidate
      }
    }
  } catch {
    $results += [pscustomobject]@{
      imagePath = $relativePath
      status = "error"
      error = $_.Exception.Message
    }
  } finally {
    Remove-Item -LiteralPath "$base.txt" -ErrorAction SilentlyContinue
  }
}

if (-not $WhatIf) {
  Write-JsonFile -Path $OutPath -Value ([pscustomobject]@{
    generated = (Get-Date).ToString("s")
    posterDir = $PosterDir
    counts = [pscustomobject]@{
      images = $images.Count
      complete = @($results | Where-Object status -eq "ocr-complete").Count
      errors = @($results | Where-Object status -eq "error").Count
      missingTesseract = @($results | Where-Object status -eq "missing-tesseract").Count
    }
    results = @($results)
  })

  if ($CreateCandidates) {
    Write-JsonFile -Path $PendingPath -Value $pendingDoc
  }
}

Write-Host "Poster OCR scan complete:"
Write-Host "  Images:  $($images.Count)"
Write-Host "  Output:  $OutPath"
if ($CreateCandidates) {
  Write-Host "  Pending: $PendingPath"
}
if (-not $tesseract) {
  Write-Host "  OCR not run because Tesseract was not found on PATH."
}
