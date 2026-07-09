# Event Tracking Automation Plan

Last updated: 2026-07-09

## Goal

Track Korcula island events extensively while keeping the public deployment compatible with free Cloudflare hosting and Workers where possible.

## Recommended Architecture

```text
Static public site
  reads:
    site/data/events.json
    site/data/sources.json

Source checker
  reads:
    site/data/sources.json
  writes:
    source snapshots
    site/data/pending-events.json

Human review
  approves:
    pending event candidates
  publishes:
    site/data/events.json
```

## Auto-Publish Policy

Oliver wants reliable sources/events to publish automatically and low-confidence candidates to require review.

Current policy lives in `site/data/ingestion-policy.json`:

- Auto-publish can apply only when:
  - source type is official board, official event page, cultural organiser, or ticketing platform
  - source confidence is high
  - scrape mode is stable HTML or ticketing
  - candidate contains a complete structured event object
  - event has required fields: id, date, town, venue, cats, hr, en, sourceId, source
  - event is not `verify:true`
  - event id is not already in `events.json`
  - date/time is not ambiguous
- Human review is required for:
  - Facebook / Instagram / social groups
  - OCR and posters
  - search leads
  - village/community leads
  - sports leads
  - wine/venue/hotel leads unless later promoted to a high-confidence structured parser

## Cloudflare Compatibility

- Static hosting can serve the public calendar, JSON data, images, CSS, and JS.
- Static hosting alone cannot run scheduled scrapers.
- Scheduled source checks should run as a Cloudflare Worker with Cron Triggers if hosted on Cloudflare.
- The free Workers plan can support modest periodic checks, but checks must be prioritized and bounded.
- Store small state/candidates in KV or D1 if moving beyond flat JSON.
- Avoid heavy OCR inside free Workers; browser/social image OCR is better handled locally, by GitHub Actions, or by a dedicated external job.

## Social Media Strategy

Socials are important for coverage but should not be trusted for direct auto-publishing.

Use social sources as:

- Discovery leads
- Manual review pages
- Search targets
- Poster/image sources when a human saves the poster into the local poster folder

Do not directly publish from:

- Facebook posts
- Instagram captions
- OCR output
- Facebook groups

All of those should become `pending-events.json` candidates first.

## Poster / OCR Strategy

Best path:

1. Save posters/flyers from social pages into `2026 Events/` or another intake folder.
2. Run `scripts/ocr-posters.ps1`.
3. Review extracted text, date hints, and time hints.
4. Create or approve a candidate event.
5. Merge approved events into `events.json`.

OCR can help with:

- event titles
- dates
- start times
- venue names
- performer names
- ticket/free-entry hints

OCR cannot be trusted alone because Croatian diacritics, poster typography, and image quality vary.

## High Priority Missing Source Types

- Village/community boards:
  - Mjesni odbor Račišće
  - Udruga Mladih Račišće
  - Kneže local sports/social sources
  - Pupnat / Žrnovo / Čara community organisers
- Small sports/social events:
  - buće tournaments
  - football / small-sided soccer tournaments
  - waterpolo tournaments
  - basketball tournaments
  - children's buće
  - village football/sports games
  - fishing nights and local fešte
- Nightlife:
  - Blue Bar / Blue Club
  - Boogie Jungle
  - La Banya
  - Prvi Žal
  - Konoba Casablanca
- Ticketing:
  - CoreEvent
  - venue ticket pages

## Expanded Source Directory Status

As of 2026-07-09, `site/data/sources.json` has been expanded to include:

- island-wide social groups and event aggregators
- Korculainfo village/tradition guide pages
- Žrnovo / Postrana local leads
- Pupnat local and Kumpanjija leads
- Čara / Zavalatica local leads
- Smokvica-Brna website and Facebook
- central-island wine and winery event leads
- Aminess Korčula hotel entertainment
- Vela Luka nightlife/cultural leads
- Lumbarda beach bar and venue leads

The directory is broader but still not guaranteed exhaustive. Treat it as a maintained source map that should grow as new posters, venues, associations, and social pages are discovered.

## Current Local Scripts

- `scripts/check-sources.ps1`
  - Fetches stable HTML/ticket sources.
  - Skips social/manual sources unless explicitly requested.
  - Writes runtime summaries to `%TEMP%/korcula-source-checks/` by default because the OneDrive workspace can block shell-created runtime files.
  - Supports `-Priority high` and `-Limit N` for bounded free-tier-friendly runs.
- `scripts/extract-event-candidates.ps1`
  - Converts source-check snapshots into conservative pending candidates.
- `scripts/classify-pending-events.ps1`
  - Applies `site/data/ingestion-policy.json`.
  - Marks complete high-confidence structured candidates as `approved`.
  - Marks low-confidence/fuzzy candidates as `needs-review`.
- `scripts/ocr-posters.ps1`
  - Runs local OCR over poster images if Tesseract is installed.
  - Emits OCR review output.
  - Writes runtime OCR output to `%TEMP%/korcula-poster-ocr/` by default.
- `scripts/merge-approved-events.ps1`
  - Merges approved pending candidates into `events.json`.
- `scripts/run-ingestion-pipeline.ps1`
  - Runs check, extract, classify, and merge steps together.

## GitHub Actions

`/.github/workflows/event-ingestion.yml` is scaffolded for scheduled ingestion once the project is in GitHub.

It:

- runs daily
- can also be started manually
- installs Tesseract OCR on the runner
- runs the ingestion pipeline
- runs poster OCR
- opens a pull request with auto-approved changes and pending review candidates

This keeps public publishing controlled while still allowing reliable structured events to move through automatically.

## Remaining Parser Work

The auto-publish policy is implemented, but auto-publishing only happens when a candidate already contains a complete structured `event` object.

Next parser work:

- build source-specific parsers for the most reliable pages first:
  - Visit Korčula event pages
  - Moreška ticket schedule
  - CoreEvent ticket pages
  - Visit Lumbarda / Vela Luka / Blato official programme pages where structure is stable
- keep social/OCR/search parsers as candidate-only until reviewed
- add tests using saved HTML snippets before enabling any parser to auto-publish
