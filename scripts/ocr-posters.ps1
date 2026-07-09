param(
  [string]$PosterDir = "2026 Events",
  [string]$OutPath = "site/data/poster-ocr-report.json",
  [string]$PendingPath = "site/data/pending-events.json",
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

$pendingDoc = $null
$existingCandidateIds = @{}
if ($CreateCandidates) {
  $pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json
  foreach ($candidate in @($pendingDoc.candidates)) {
    $existingCandidateIds[[string]$candidate.id] = $true
  }
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

    $dateHints = [regex]::Matches($text, '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b') | ForEach-Object { $_.Value }
    $timeHints = [regex]::Matches($text, '\b([01]?\d|2[0-3])[:.](\d{2})\b') | ForEach-Object { $_.Value }
    $textSnippet = if ($text.Length -gt 1200) { $text.Substring(0, 1200) } else { $text }

    $result = [pscustomobject]@{
      imagePath = $relativePath
      status = "ocr-complete"
      textSnippet = $textSnippet
      dateHints = @($dateHints)
      timeHints = @($timeHints)
      reviewStatus = "needs-review"
    }
    $results += $result

    if ($CreateCandidates -and -not $existingCandidateIds.ContainsKey($candidateId) -and $text) {
      $pendingDoc.candidates += [pscustomobject]@{
        id = $candidateId
        status = "needs-review"
        discoveredAt = (Get-Date).ToString("s")
        sourceId = "local-poster-folder"
        sourceName = "Local Poster Folder"
        sourceUrl = $relativePath
        kind = "ocr"
        scrapeMode = "poster-folder"
        evidence = @{
          imagePath = $relativePath
          keywordHits = @()
          dateHints = @($dateHints)
          timeHints = @($timeHints)
          textSnippet = $textSnippet
        }
        event = $null
        notes = "Poster OCR candidate. Review image and OCR text before creating an event."
        reviewMode = "human-review"
        reviewReasons = @("poster OCR requires human review")
      }
      $existingCandidateIds[$candidateId] = $true
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
