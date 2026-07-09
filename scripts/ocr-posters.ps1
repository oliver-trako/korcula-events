param(
  [string]$PosterDir = "2026 Events",
  [string]$OutPath = (Join-Path $env:TEMP "korcula-poster-ocr/ocr-results.json")
)

$ErrorActionPreference = "Stop"

function Ensure-Dir {
  param([string]$Path)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

$tesseract = Get-Command tesseract -ErrorAction SilentlyContinue
$images = Get-ChildItem -LiteralPath $PosterDir -File -Recurse |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp|jfif)$' } |
  Sort-Object LastWriteTime

$results = @()

foreach ($img in $images) {
  if (-not $tesseract) {
    $results += [pscustomobject]@{
      imagePath = $img.FullName
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

    $results += [pscustomobject]@{
      imagePath = $img.FullName
      status = "ocr-complete"
      text = $text
      dateHints = @($dateHints)
      timeHints = @($timeHints)
      reviewStatus = "needs-review"
    }
  } catch {
    $results += [pscustomobject]@{
      imagePath = $img.FullName
      status = "error"
      error = $_.Exception.Message
    }
  } finally {
    Remove-Item -LiteralPath "$base.txt" -ErrorAction SilentlyContinue
  }
}

Ensure-Dir $OutPath
$results | ConvertTo-Json -Depth 8 | Set-Content -Path $OutPath -Encoding UTF8

Write-Host "Poster OCR scan complete:"
Write-Host "  Images:  $($images.Count)"
Write-Host "  Output:  $OutPath"
if (-not $tesseract) {
  Write-Host "  OCR not run because Tesseract was not found on PATH."
}
