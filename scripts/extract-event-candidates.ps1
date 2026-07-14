param(
  [string]$SourceCheckSummary,
  [string]$PendingPath = "site/data/pending-events.json",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

if (-not $SourceCheckSummary) {
  throw "Pass -SourceCheckSummary pointing to tmp/source-checks/<run>/summary.json."
}

function Decode-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  return [System.Net.WebUtility]::HtmlDecode($Text)
}

function Normalize-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  $normalized = (Decode-Text $Text).ToLowerInvariant().Normalize([System.Text.NormalizationForm]::FormD)
  $chars = foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      $char
    }
  }
  return ((-join $chars) -replace '[^a-z0-9]+', ' ').Trim()
}

function New-Slug {
  param([string]$Text)
  $normalized = (Decode-Text $Text).ToLowerInvariant()
  $normalized = $normalized.Normalize([System.Text.NormalizationForm]::FormD)
  $chars = foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      $char
    }
  }
  $normalized = -join $chars
  return ($normalized -replace '[^a-z0-9]+', '-').Trim('-')
}

function Convert-NumericDate {
  param([string]$Value)
  $m = [regex]::Match($Value, '^(?<d>\d{1,2})[./-](?<m>\d{1,2})[./-](?<y>\d{4})$')
  if (-not $m.Success) { return $null }
  return "{0:D4}-{1:D2}-{2:D2}" -f [int]$m.Groups['y'].Value, [int]$m.Groups['m'].Value, [int]$m.Groups['d'].Value
}

function Convert-KorculaShortDate {
  param([string]$Day, [string]$Month, [string]$Year = "2026")
  if (-not $Day -or -not $Month) { return $null }
  if (-not $Year) { $Year = "2026" }
  if ($Year.Length -eq 2) { $Year = "20$Year" }
  return "{0:D4}-{1:D2}-{2:D2}" -f [int]$Year, [int]$Month, [int]$Day
}

function Convert-TextDate {
  param([string]$Day, [string]$Month, [string]$Year)
  $months = @{
    jan = 1; january = 1
    feb = 2; february = 2
    mar = 3; march = 3
    apr = 4; april = 4
    may = 5
    jun = 6; june = 6
    jul = 7; july = 7
    aug = 8; august = 8
    sep = 9; sept = 9; september = 9
    oct = 10; october = 10
    nov = 11; november = 11
    dec = 12; december = 12
  }
  $key = $Month.ToLowerInvariant()
  if (-not $months.ContainsKey($key)) { return $null }
  return "{0:D4}-{1:D2}-{2:D2}" -f [int]$Year, [int]$months[$key], [int]$Day
}

function Convert-ClockTime {
  param([string]$Value)
  if (-not $Value) { return $null }
  $m = [regex]::Match($Value.Trim(), '^(?<h>\d{1,2})(?:[:.](?<m>\d{2}))?\s*(?<ampm>AM|PM)?$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $m.Success) { return $null }
  $hour = [int]$m.Groups['h'].Value
  $minute = if ($m.Groups['m'].Success) { [int]$m.Groups['m'].Value } else { 0 }
  $ampm = $m.Groups['ampm'].Value.ToUpperInvariant()
  if ($ampm -eq "PM" -and $hour -lt 12) { $hour += 12 }
  if ($ampm -eq "AM" -and $hour -eq 12) { $hour = 0 }
  if ($hour -gt 23 -or $minute -gt 59) { return $null }
  return "{0:D2}:{1:D2}" -f $hour, $minute
}

function Convert-HtmlToText {
  param([string]$Html)
  if (-not $Html) { return "" }
  $text = ($Html -replace '<script[\s\S]*?</script>', ' ' -replace '<style[\s\S]*?</style>', ' ' -replace '<[^>]+>', ' ')
  return (Decode-Text (($text -replace '\s+', ' ').Trim()))
}

function Invoke-FetchHtml {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 20 -MaximumRedirection 8
    return [string]$response.Content
  } catch {
    Write-Warning "Could not fetch $Url`: $($_.Exception.Message)"
    return $null
  }
}

function Get-CandidateSignature {
  param($SourceUrl, $Event, $DateHints, $TimeHints, $KeywordHits)
  if ($Event -and $Event.id) { return "event::$($Event.id)".ToLowerInvariant() }
  $parts = @(
    [string]$SourceUrl
    (@($DateHints) -join "|")
    (@($TimeHints) -join "|")
    (@($KeywordHits) -join "|")
  )
  return ($parts -join "::").ToLowerInvariant()
}

function Test-NoisyLead {
  param($Row, [string]$Text)
  $sourceId = [string]$Row.sourceId
  $snippet = [string]$Row.textSnippet

  if ($sourceId -eq "blue-korcula" -and $snippet -match 'Pick a Date and Time|Which facility|reservation') {
    return $true
  }
  if ($sourceId -match 'korculainfo|village' -and $Text -match 'Bus timetable|Stop Weekdays|Stop 1 daily|All villages') {
    return $true
  }
  if ($sourceId -match 'aminess' -and $Text -match 'Wellness|beauty center|Contact Write to us|loyalty account') {
    return $true
  }
  if ($sourceId -eq "la-banya" -and $Text -match 'Book a table|View menu|Watermelon and feta') {
    return $true
  }

  return $false
}

function Get-DefaultTown {
  param([string]$SourceId)
  if ($SourceId -match 'racisce') { return 'racisce' }
  if ($SourceId -match 'lumbarda') { return 'lumbarda' }
  if ($SourceId -match 'vela-luka') { return 'vela-luka' }
  if ($SourceId -match 'orebic') { return 'orebic' }
  if ($SourceId -match 'smokvica') { return 'smokvica' }
  if ($SourceId -match 'blato') { return 'blato' }
  return 'korcula'
}

function Get-DefaultVenue {
  param([string]$SourceId)
  if ($SourceId -match 'racisce') { return 'Racisce' }
  if ($SourceId -match 'lumbarda') { return 'Lumbarda' }
  if ($SourceId -match 'vela-luka') { return 'Vela Luka' }
  if ($SourceId -match 'orebic') { return 'Orebic' }
  if ($SourceId -match 'smokvica') { return 'Smokvica / Brna' }
  return 'Korcula'
}

function Get-VisitKorculaEventLinks {
  param([string]$Url)
  $html = Invoke-FetchHtml -Url $Url
  if (-not $html) { return @() }

  $links = @{}
  foreach ($match in [regex]::Matches($html, 'href=["''](?<href>[^"'']*/en/events/[^"'']+/)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $href = Decode-Text $match.Groups['href'].Value
    if ($href -match '/en/events/(feed|page/\d+)/?$') { continue }
    if ($href.StartsWith('/')) { $href = "https://visitkorcula.eu$href" }
    if ($href -notmatch '^https://visitkorcula\.eu/en/events/[^/]+/$') { continue }
    $links[$href] = $true
  }
  return @($links.Keys | Sort-Object)
}

function Get-VisitKorculaCategory {
  param([string]$Title, [string]$Text)
  $combined = Normalize-Text "$Title $Text"
  $cats = [System.Collections.Generic.List[string]]::new()
  if ($combined -match 'kino|cinema|film') { [void]$cats.Add("film") }
  if ($combined -match 'moreska|sword|dance|theodor|theodor') { [void]$cats.Add("folklore") }
  if ($combined -match 'festival|festivity|day of') { [void]$cats.Add("festival") }
  if ($combined -match 'robot|programming|workshop|school|children|chess') { [void]$cats.Add("kids") }
  if ($combined -match 'workshop|school|programming|robot') { [void]$cats.Add("workshop") }
  if ($combined -match 'chess|sah') { [void]$cats.Add("sports") }
  if ($combined -match 'mass|procession|brotherhood|theodor') { [void]$cats.Add("religious") }
  if ($cats.Count -eq 0) { [void]$cats.Add("culture") }
  return @($cats | Select-Object -Unique)
}

function Get-VisitKorculaDetailEvent {
  param([string]$Url)

  $html = Invoke-FetchHtml -Url $Url
  if (-not $html) { return $null }
  $text = Convert-HtmlToText $html
  $main = $text
  $start = $main.IndexOf('News Events', [System.StringComparison]::OrdinalIgnoreCase)
  if ($start -ge 0) { $main = $main.Substring($start) }
  $other = $main.IndexOf('Other events', [System.StringComparison]::OrdinalIgnoreCase)
  if ($other -gt 0) { $main = $main.Substring(0, $other) }

  $title = $null
  $titleMatch = [regex]::Match($main, 'EN FR IT DE HR\s+(?<title>.+?)\s+Add Event', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($titleMatch.Success) {
    $title = ($titleMatch.Groups['title'].Value -replace '\s+', ' ').Trim()
  } else {
    $htmlTitle = [regex]::Match($html, '<title[^>]*>(?<title>[\s\S]*?)</title>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($htmlTitle.Success) {
      $title = ((Decode-Text ($htmlTitle.Groups['title'].Value -replace '<[^>]+>', ' ')) -replace '\|.*$', '').Trim()
    }
  }
  if (-not $title -or $title.Length -lt 4) { return $null }

  $date = $null
  $endDate = $null
  $rangeMatch = [regex]::Match($main, 'Add Event(?:\s+Photo\s+[^0-9]+)?\s*(?<sd>\d{1,2})\s*-\s*(?<ed>\d{1,2})\s+(?<sm>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*-\s*(?<em>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($rangeMatch.Success) {
    $date = Convert-TextDate $rangeMatch.Groups['sd'].Value $rangeMatch.Groups['sm'].Value "2026"
    $endDate = Convert-TextDate $rangeMatch.Groups['ed'].Value $rangeMatch.Groups['em'].Value "2026"
  } else {
    $singleDateMatch = [regex]::Match($main, 'Add Event(?:\s+Photo\s+[^0-9]+)?\s*(?<d>\d{1,2})\s+(?<m>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($singleDateMatch.Success) {
      $date = Convert-TextDate $singleDateMatch.Groups['d'].Value $singleDateMatch.Groups['m'].Value "2026"
    }
  }
  if (-not $date -or $date -lt '2026-01-01') { return $null }

  $time = $null
  $recurring = $null
  $recurringMatch = [regex]::Match($main, 'Every\s+(?<days>[A-Za-z,\s]+?)\s+at\s+(?<time>\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($recurringMatch.Success) {
    $time = Convert-ClockTime $recurringMatch.Groups['time'].Value
    $recurring = "Every $($recurringMatch.Groups['days'].Value.Trim())"
  }
  if (-not $time) {
    $atTimeMatch = [regex]::Match($main, '\bat\s+(?<time>\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($atTimeMatch.Success) { $time = Convert-ClockTime $atTimeMatch.Groups['time'].Value }
  }
  if (-not $time) {
    $plainTimeMatch = [regex]::Match($main, '\b(?<time>[012]?\d:\d{2})\b')
    if ($plainTimeMatch.Success) { $time = Convert-ClockTime $plainTimeMatch.Groups['time'].Value }
  }

  $venue = $null
  $venueMatch = [regex]::Match($main, '\bin\s+(?<venue>Ljetno kino(?:\s*/\s*[^:]+)?)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($venueMatch.Success) {
    $venue = ($venueMatch.Groups['venue'].Value -replace '\s+', ' ').Trim()
    if ($venue -match 'Ljetno kino') { $venue = "Ljetno kino / Korcula Summer Theatre" }
  }
  if (-not $venue) {
    $libraryMatch = [regex]::Match($main, '(?<venue>Ivan Vidali Public Library(?:,\s*[^ ]+)?)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($libraryMatch.Success) { $venue = "Ivan Vidali Public Library, Korcula" }
  }
  if (-not $venue) {
    $squareMatch = [regex]::Match($main, '\bat the\s+(?<venue>Trg pomirenja square)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($squareMatch.Success) { $venue = $squareMatch.Groups['venue'].Value.Trim() }
  }
  if (-not $venue) { $venue = "Korcula" }

  $id = "visit-korcula-$date-$(New-Slug $title)"
  $event = [ordered]@{
    id = $id
    date = $date
    time = $time
    town = "korcula"
    venue = $venue
    cats = @(Get-VisitKorculaCategory -Title $title -Text $main)
    hr = $title
    en = $title
    sourceId = "visit-korcula"
    source = $Url
    website = $Url
  }
  if ($endDate) {
    $event.endDate = $endDate
    $event.seasonal = $true
  }
  if ($recurring) {
    $event.recurring = $recurring
  }
  if (-not $time -or $venue -eq "Korcula") {
    $event.verify = $true
  }
  return [pscustomobject]$event
}

function Get-VisitKorculaEvents {
  param($Row, [string]$Text)

  if ([string]$Row.sourceId -notin @("visit-korcula", "visit-korcula-racisce")) {
    return @()
  }

  if ([string]$Row.sourceId -eq "visit-korcula") {
    $detailEvents = @()
    foreach ($link in Get-VisitKorculaEventLinks -Url ([string]$Row.url)) {
      $event = Get-VisitKorculaDetailEvent -Url $link
      if ($event) { $detailEvents += $event }
    }
    return @($detailEvents)
  }

  $events = @()
  $seen = @{}
  $pattern = '(?<start>\d{1,2}\.\d{1,2}\.\d{4})(?:\s*-\s*(?<end>\d{1,2}\.\d{1,2}\.\d{4}))?\s+(?<title>.*?)(?=\s+\d{1,2}\.\d{1,2}\.\d{4}(?:\s*-\s*\d{1,2}\.\d{1,2}\.\d{4})?\s+|Welcome to|Tourist Board|News Events|$)'

  foreach ($match in [regex]::Matches($Text, $pattern)) {
    $title = (Decode-Text $match.Groups['title'].Value).Trim()
    $title = ($title -replace '\s+', ' ').Trim().Trim('-').Trim('|').Trim()
    if (-not $title -or $title.Length -lt 4) { continue }
    if ($title -match 'Discover|Welcome to|Download the brochure|Events EN|Tourist Board|Previous View all Next|View all Next') { continue }
    if ([string]$Row.sourceId -eq "visit-korcula-racisce") {
      $titleContext = Normalize-Text "$title $($match.Value)"
      if ($titleContext -notmatch '\bracisce\b|\braciscu\b|\bračišće\b|\bračišću\b') { continue }
    }

    $date = Convert-NumericDate $match.Groups['start'].Value
    if (-not $date -or $date -lt '2026-01-01') { continue }
    $endDate = if ($match.Groups['end'].Success) { Convert-NumericDate $match.Groups['end'].Value } else { $null }
    $id = "visit-korcula-$date-$(New-Slug $title)"
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = $true

    $event = [ordered]@{
      id = $id
      date = $date
      town = Get-DefaultTown ([string]$Row.sourceId)
      venue = Get-DefaultVenue ([string]$Row.sourceId)
      cats = @("culture")
      hr = $title
      en = $title
      sourceId = $Row.sourceId
      source = $Row.url
      website = $Row.url
      verify = $true
    }
    if ($endDate) {
      $event.endDate = $endDate
      $event.seasonal = $true
    }
    $events += [pscustomobject]$event
  }

  return @($events)
}

function Get-MoreskaTicketEvents {
  param($Row, [string]$Text)

  if ([string]$Row.sourceId -ne "moreska") {
    return @()
  }

  $events = @()
  $sep = '[\u00b7\|,-]'
  $weekday = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday'
  $pattern = "(?<day>\d{1,2})\s+(?<month>JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)\s+(?<year>\d{4})(?:\s+\S+)?\s+(?<weekday>$weekday)\s+$sep\s+(?<time>\d{1,2}:\d{2})\s+$sep\s+(?<venue>.*?)(?=\s+Available|\s+Few tickets|\s+Sold|\s+Book Tickets|$)"

  foreach ($match in [regex]::Matches($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $date = Convert-TextDate $match.Groups['day'].Value $match.Groups['month'].Value $match.Groups['year'].Value
    if (-not $date) { continue }
    $venue = (Decode-Text $match.Groups['venue'].Value).Trim()
    if (-not $venue) { $venue = "Summer Cinema, Korcula" }

    $event = [pscustomobject][ordered]@{
      id = "moreska-$date"
      date = $date
      time = $match.Groups['time'].Value
      town = "korcula"
      venue = "$venue, Korcula"
      cats = @("folklore", "festival")
      hr = "Moreska - viteski macevalacki ples"
      en = "Moreska - historic sword dance"
      desc = [pscustomobject]@{
        en = "Korcula's famous sword dance with live wind orchestra. Tickets are listed on the official Moreska website."
        hr = "Poznati korculanski macevalacki ples uz puhacki orkestar. Ulaznice su navedene na sluzbenoj stranici Moreske."
      }
      ticketUrl = "https://moreska.eu/tickets"
      website = "https://moreska.eu/"
      sourceId = $Row.sourceId
      source = $Row.url
    }
    $events += $event
  }

  return @($events)
}

function Get-KulturaKorculaEvents {
  param($Row, [string]$Text)

  if ([string]$Row.sourceId -ne "centar-kulture-korcula") {
    return @()
  }

  $events = @()
  $seen = @{}
  $categoryPattern = "Kino Mediteran|KINO|Kino|Koncert klasične glazbe|Koncert|Kazalište|Predstava"
  $weekdayPattern = "ponedjeljak|utorak|srijeda|četvrtak|petak|subota|nedjelja"
  $pattern = "(?<category>$categoryPattern)\s*/\s*(?<title>[^/]{3,160}?)\s*/\s*(?:(?<weekday>$weekdayPattern)\s*,\s*)?(?<day>\d{1,2})\.(?<month>\d{1,2})\.?(?:\s*(?<year>\d{4}))?\s*,?\s*(?<time>\d{1,2}:\d{2})(?:\s*/\s*(?<venue>[^/]{0,100}?))?(?=\s+[A-ZČĆŽŠĐ]|\s+Administrator|\s+$)"

  foreach ($match in [regex]::Matches($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $category = (Decode-Text $match.Groups['category'].Value).Trim()
    $title = (Decode-Text $match.Groups['title'].Value).Trim()
    $title = ($title -replace '\s+', ' ').Trim().Trim('-').Trim('|').Trim()
    if (-not $title -or $title.Length -lt 3) { continue }
    $titleNorm = Normalize-Text $title
    if ($titleNorm -match 'pocetna|najave dogadanja|kontakt|trazi facebook') { continue }

    $date = Convert-KorculaShortDate $match.Groups['day'].Value $match.Groups['month'].Value $match.Groups['year'].Value
    if (-not $date -or $date -lt '2026-01-01') { continue }

    $venue = (Decode-Text $match.Groups['venue'].Value).Trim()
    $venue = ($venue -replace '\s+', ' ').Trim().Trim('/').Trim()
    if ($venue -match 'Ljetno') { $venue = "Ljetno kino Korčula" }
    elseif ($venue -match 'Katedrala') { $venue = "Katedrala sv. Marka" }
    elseif ($venue -match 'Centar za kulturu') { $venue = "Centar za kulturu Korčula" }
    elseif (-not $venue -or $venue.Length -lt 4 -or $venue -match '^[0-9+]+$|sink|Iznad|Žanr|Režija') {
      if ($category -match 'Mediteran') { $venue = "Ljetno kino Korčula" }
      else { $venue = "Centar za kulturu Korčula" }
    }

    $cats = @("film")
    if ($category -match 'Koncert') { $cats = @("music") }
    elseif ($category -match 'Kazalište|Predstava') { $cats = @("theatre") }

    $id = "kultura-korcula-$date-$(New-Slug $title)"
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = $true

    $event = [pscustomobject][ordered]@{
      id = $id
      date = $date
      time = $match.Groups['time'].Value
      town = "korcula"
      venue = $venue
      cats = $cats
      hr = "$category / $title"
      en = "$category / $title"
      sourceId = $Row.sourceId
      source = $Row.url
      website = $Row.url
      verify = $true
    }
    $events += $event
  }

  return @($events)
}

function New-Candidate {
  param($Row, $Event, [string]$Text, $DateHints, $TimeHints)

  $candidateId = if ($Event -and $Event.id) { "candidate-$($Event.id)" } else { "candidate-" + ([guid]::NewGuid().ToString("n").Substring(0, 12)) }
  $snippet = if ($Event) {
    $needle = if ($Event.en) { [string]$Event.en } else { [string]$Event.date }
    $idx = $Text.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase)
    if ($idx -lt 0) { $idx = $Text.IndexOf([string]$Event.date, [System.StringComparison]::OrdinalIgnoreCase) }
    $start = if ($idx -gt 0) { [Math]::Max(0, $idx - 120) } else { 0 }
    $Text.Substring($start, [Math]::Min(700, $Text.Length - $start)).Trim()
  } else {
    [string]$Row.textSnippet
  }

  return [pscustomobject]@{
    id = $candidateId
    status = "needs-review"
    discoveredAt = (Get-Date).ToString("s")
    sourceId = $Row.sourceId
    sourceName = $Row.sourceName
    sourceUrl = $Row.url
    kind = $Row.kind
    scrapeMode = $Row.scrapeMode
    evidence = @{
      keywordHits = @($Row.keywordHits)
      dateHints = @($DateHints)
      timeHints = @($TimeHints)
      pageTitle = $Row.pageTitle
      textSnippet = $snippet
      contentLength = $Row.contentLength
      textPath = $Row.textPath
    }
    event = $Event
    notes = if ($Event) {
      "Structured event candidate extracted from source page."
    } else {
      "Review extracted evidence and create event object before approval."
    }
  }
}

$summary = Get-Content -Raw -Path $SourceCheckSummary | ConvertFrom-Json
$pendingDoc = Get-Content -Raw -Path $PendingPath | ConvertFrom-Json

$existingSignatures = @{}
foreach ($candidate in @($pendingDoc.candidates)) {
  $evidence = $candidate.evidence
  $signature = Get-CandidateSignature `
    -SourceUrl $candidate.sourceUrl `
    -Event $candidate.event `
    -DateHints @($evidence.dateHints) `
    -TimeHints @($evidence.timeHints) `
    -KeywordHits @($evidence.keywordHits)
  $existingSignatures[$signature] = $true
}

$newCandidates = @()

foreach ($row in $summary | Where-Object { $_.status -eq "fetched" }) {
  $text = if ($row.textPath -and (Test-Path -LiteralPath $row.textPath)) {
    Get-Content -Raw -LiteralPath $row.textPath
  } else {
    [string]$row.textSnippet
  }
  $text = Decode-Text $text

  $dateHints = if ($row.PSObject.Properties.Name -contains "dateHints") {
    @($row.dateHints)
  } else {
    @([regex]::Matches($text, '\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b') | Select-Object -First 20 | ForEach-Object { $_.Value })
  }
  $timeHints = if ($row.PSObject.Properties.Name -contains "timeHints") {
    @($row.timeHints)
  } else {
    @([regex]::Matches($text, '\b([01]?\d|2[0-3])[:.](\d{2})\b') | Select-Object -First 20 | ForEach-Object { $_.Value })
  }

  $structuredEvents = @()
  $structuredEvents += Get-MoreskaTicketEvents -Row $row -Text $text
  $structuredEvents += Get-VisitKorculaEvents -Row $row -Text $text
  $structuredEvents += Get-KulturaKorculaEvents -Row $row -Text $text

  if ($structuredEvents.Count -gt 0) {
    foreach ($event in $structuredEvents) {
      $signature = Get-CandidateSignature -SourceUrl $row.url -Event $event -DateHints @($dateHints) -TimeHints @($timeHints) -KeywordHits @($row.keywordHits)
      if ($existingSignatures.ContainsKey($signature)) { continue }
      $newCandidates += New-Candidate -Row $row -Event $event -Text $text -DateHints @($dateHints) -TimeHints @($timeHints)
      $existingSignatures[$signature] = $true
    }
    continue
  }

  if ($dateHints.Count -eq 0 -and $timeHints.Count -eq 0) {
    continue
  }

  if (Test-NoisyLead -Row $row -Text $text) {
    continue
  }

  $signature = Get-CandidateSignature -SourceUrl $row.url -Event $null -DateHints @($dateHints) -TimeHints @($timeHints) -KeywordHits @($row.keywordHits)
  if ($existingSignatures.ContainsKey($signature)) { continue }

  $newCandidates += New-Candidate -Row $row -Event $null -Text $text -DateHints @($dateHints) -TimeHints @($timeHints)
  $existingSignatures[$signature] = $true
}

if ($newCandidates.Count -gt 0 -and -not $WhatIf) {
  $pendingDoc.candidates += $newCandidates
  $pendingDoc | ConvertTo-Json -Depth 30 | Set-Content -Path $PendingPath -Encoding UTF8
}

Write-Host "Candidate extraction complete:"
Write-Host "  New candidates: $($newCandidates.Count)"
Write-Host "  Structured:     $(@($newCandidates | Where-Object event).Count)"
Write-Host "  Pending file:   $PendingPath"
if ($WhatIf) {
  Write-Host "  WhatIf: no files changed"
}
