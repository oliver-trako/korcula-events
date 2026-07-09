param(
  [string]$SourcesPath = "site/data/sources.json",
  [string]$OutPath = "site/data/social-source-report.json",
  [string]$Priority,
  [switch]$IncludeSearchLeads
)

$ErrorActionPreference = "Stop"

function Ensure-FileDir {
  param([string]$Path)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

function Get-Platform {
  param([string]$Kind, [string]$Url)
  if ($Kind -match "instagram" -or $Url -match "instagram\.com") { return "instagram" }
  if ($Kind -match "facebook" -or $Url -match "facebook\.com") { return "facebook" }
  if ($Url -match "google\.com/search") { return "search" }
  return "social"
}

$sourcesDoc = Get-Content -Raw -Path $SourcesPath | ConvertFrom-Json
$rows = @()

foreach ($source in $sourcesDoc.sources) {
  if ($Priority -and [string]$source.priority -ne $Priority) {
    continue
  }

  foreach ($entry in $source.urls) {
    $mode = [string]$entry.scrapeMode
    if ($mode -ne "manual-social" -and -not ($IncludeSearchLeads -and $mode -eq "search-lead")) {
      continue
    }

    $platform = Get-Platform -Kind ([string]$entry.kind) -Url ([string]$entry.url)
    $rows += [pscustomobject]@{
      sourceId = $source.id
      sourceName = $source.name
      town = $source.town
      sourceType = $source.type
      priority = $source.priority
      confidence = $source.confidence
      kind = $entry.kind
      platform = $platform
      url = $entry.url
      keywords = @($source.keywords)
      notes = $source.notes
      reviewMode = "manual-social-review"
      action = if ($platform -eq "search") { "Open search and check new results/posts." } else { "Open page/group/profile and review latest posts, posters, stories, and event tabs." }
    }
  }
}

$report = [pscustomobject]@{
  generated = (Get-Date).ToString("s")
  priority = $Priority
  includeSearchLeads = [bool]$IncludeSearchLeads
  purpose = "Manual social monitoring queue. Facebook groups and many Instagram/Facebook pages cannot be reliably scraped from GitHub Actions without official API access or a logged-in browser session."
  officialApiNotes = @(
    "Facebook Pages and Instagram professional accounts can be integrated later with Meta Graph API tokens.",
    "Facebook Groups are not covered by the old public Groups API and should be treated as manual review sources unless a compliant data provider or approved Meta access is added.",
    "Never auto-publish social candidates; create pending candidates with human review."
  )
  counts = [pscustomobject]@{
    total = $rows.Count
    facebook = @($rows | Where-Object platform -eq "facebook").Count
    instagram = @($rows | Where-Object platform -eq "instagram").Count
    search = @($rows | Where-Object platform -eq "search").Count
  }
  rows = @($rows)
}

Ensure-FileDir $OutPath
$json = $report | ConvertTo-Json -Depth 12
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $OutPath)).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $OutPath), $json + [Environment]::NewLine, $utf8NoBom)

Write-Host "Social source report complete:"
Write-Host "  Output:    $OutPath"
Write-Host "  Sources:   $($rows.Count)"
Write-Host "  Facebook:  $($report.counts.facebook)"
Write-Host "  Instagram: $($report.counts.instagram)"
Write-Host "  Search:    $($report.counts.search)"
