param(
  [string]$SourcesPath = "site/data/sources.json",
  [string]$OutDir = (Join-Path ([System.IO.Path]::GetTempPath()) "korcula-source-checks"),
  [switch]$IncludeSocial,
  [switch]$SaveSnapshots,
  [string]$Priority,
  [int]$Limit = 0
)

$ErrorActionPreference = "Stop"

function New-SafeName {
  param([string]$Text)
  return ($Text -replace '[^a-zA-Z0-9._-]+', '-').Trim('-').ToLowerInvariant()
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Get-FirstMatchValues {
  param(
    [string]$Text,
    [string]$Pattern,
    [int]$Limit = 20
  )
  return @([regex]::Matches($Text, $Pattern) | Select-Object -First $Limit | ForEach-Object { $_.Value })
}

function Get-TextSnippet {
  param(
    [string]$Text,
    [string[]]$Needles,
    [int]$Length = 900
  )

  if (-not $Text) { return "" }

  $firstIndex = -1
  foreach ($needle in $Needles) {
    if (-not $needle) { continue }
    $idx = $Text.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase)
    if ($idx -ge 0 -and ($firstIndex -lt 0 -or $idx -lt $firstIndex)) {
      $firstIndex = $idx
    }
  }

  if ($firstIndex -lt 0) {
    $dateMatch = [regex]::Match($Text, '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b')
    if ($dateMatch.Success) { $firstIndex = $dateMatch.Index }
  }

  if ($firstIndex -lt 0) { $firstIndex = 0 }
  $start = [Math]::Max(0, $firstIndex - 180)
  $take = [Math]::Min($Length, $Text.Length - $start)
  return $Text.Substring($start, $take).Trim()
}

$sourcesDoc = Get-Content -Raw -Path $SourcesPath | ConvertFrom-Json
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Ensure-Dir $OutDir

$results = @()
$processed = 0

foreach ($source in $sourcesDoc.sources) {
  if ($Priority -and [string]$source.priority -ne $Priority) {
    continue
  }
  foreach ($entry in $source.urls) {
    if ($Limit -gt 0 -and $processed -ge $Limit) {
      break
    }
    $processed++
    $mode = [string]$entry.scrapeMode
    $url = [string]$entry.url

    if ($mode -in @("manual-social", "search-lead") -and -not $IncludeSocial) {
      $results += [pscustomobject]@{
        sourceId = $source.id
        sourceName = $source.name
        kind = $entry.kind
        scrapeMode = $mode
        url = $url
        status = "skipped-social"
        note = "Use as manual/social lead unless IncludeSocial is set."
      }
      continue
    }

    if ($mode -eq "poster-folder") {
      $results += [pscustomobject]@{
        sourceId = $source.id
        sourceName = $source.name
        kind = $entry.kind
        scrapeMode = $mode
        url = $url
        status = "skipped-poster-folder"
        note = "Run ocr-posters.ps1 for local poster folders."
      }
      continue
    }

    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20
      $safe = New-SafeName "$($source.id)-$($entry.kind)"

      $text = ($response.Content -replace '<script[\s\S]*?</script>', ' ' -replace '<style[\s\S]*?</style>', ' ' -replace '<[^>]+>', ' ')
      $text = ($text -replace '\s+', ' ').Trim()
      $titleMatch = [regex]::Match($response.Content, '<title[^>]*>([\s\S]*?)</title>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      $pageTitle = if ($titleMatch.Success) { (($titleMatch.Groups[1].Value -replace '<[^>]+>', ' ') -replace '\s+', ' ').Trim() } else { $null }
      $textPath = $null

      if ($SaveSnapshots) {
        $htmlPath = Join-Path $OutDir "$stamp-$safe.html"
        Set-Content -Path $htmlPath -Value $response.Content -Encoding UTF8
        $textPath = Join-Path $OutDir "$stamp-$safe.txt"
        Set-Content -Path $textPath -Value $text -Encoding UTF8
      }

      $hits = @()
      foreach ($kw in $source.keywords) {
        if ($text -match [regex]::Escape([string]$kw)) { $hits += [string]$kw }
      }

      $dateHints = Get-FirstMatchValues -Text $text -Pattern '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b'
      $timeHints = Get-FirstMatchValues -Text $text -Pattern '\b([01]?\d|2[0-3])[:.](\d{2})\b'
      $snippetNeedles = @($dateHints + $timeHints + $hits) | Where-Object { $_ } | Select-Object -First 12
      $textSnippet = Get-TextSnippet -Text $text -Needles $snippetNeedles

      $results += [pscustomobject]@{
        sourceId = $source.id
        sourceName = $source.name
        kind = $entry.kind
        scrapeMode = $mode
        url = $url
        status = "fetched"
        statusCode = [int]$response.StatusCode
        pageTitle = $pageTitle
        contentLength = $text.Length
        textSnippet = $textSnippet
        textPath = $textPath
        dateHints = @($dateHints)
        timeHints = @($timeHints)
        keywordHits = $hits
      }
    } catch {
      $results += [pscustomobject]@{
        sourceId = $source.id
        sourceName = $source.name
        kind = $entry.kind
        scrapeMode = $mode
        url = $url
        status = "error"
        error = $_.Exception.Message
      }
    }
  }
  if ($Limit -gt 0 -and $processed -ge $Limit) {
    break
  }
}

$summaryPath = Join-Path $OutDir "summary.json"
$results | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Source check complete:"
Write-Host "  Output dir: $OutDir"
Write-Host "  Summary:    $summaryPath"
Write-Host "  Fetched:    $(($results | Where-Object status -eq 'fetched').Count)"
Write-Host "  Errors:     $(($results | Where-Object status -eq 'error').Count)"
Write-Host "  Skipped:    $(($results | Where-Object { $_.status -like 'skipped-*' }).Count)"
