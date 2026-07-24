# Search performance baseline — 25 July 2026

Source: Google Search Console export `korcula-events.com-Performance-on-Search-2026-07-25.zip`.

## Measurement window

- Export filter: Web search, last 3 months.
- Actual chart data available: 8–22 July 2026.
- Total: 535 clicks from 6,712 impressions.
- Overall CTR: 7.97%.
- Average daily position across reported days: approximately 6.14.
- Device split: 454 mobile clicks, 79 desktop clicks, 2 tablet clicks.

The site only accumulated meaningful impressions from 9 July onward, so this is an early baseline rather than a mature three-month trend.

## Strong signals

- Croatian discovery terms are performing well:
  - `korčula događanja 2026`: 22 clicks / 104 impressions / 21.15% CTR / position 3.8.
  - `korcula koncerti 2026`: 7 / 76 / 9.21% / position 6.41.
  - `korcula events`: 6 / 61 / 9.84% / position 6.07.
- Place pages are efficient: 59 clicks from 445 impressions (13.26% CTR).
- Language landing pages produced 67 clicks from 549 impressions (12.20% CTR).
- Mobile accounts for about 85% of clicks.

## Highest-value CTR opportunities

These pages and queries already rank on page one but receive relatively few clicks:

- Oliver Dragojević cluster:
  - Main memorial concert page: 688 impressions, 4.94% CTR, position 6.46.
  - Oliver guide: 515 impressions, 3.5% CTR, position 7.98.
  - Ferry concert page: 461 impressions, 3.9% CTR, position 6.29.
  - Query `oliver korcula 2026`: 154 impressions, 0.65% CTR, position 9.39.
  - Query `korcula oliver dragojevic 2026`: 119 impressions, 1.68% CTR, position 6.02.
- Nightlife and venue cluster:
  - Boogie Jungle page: 165 impressions, 1.82% CTR, position 7.84.
  - Dos Locos page: 140 impressions, 1.43% CTR, position 9.58.
  - Bars and clubs guide: 96 impressions, 1.04% CTR, position 9.97.
  - Nightlife guide: 75 impressions, 2.67% CTR, position 7.2.
  - Queries for Dos Locos, Boogie Jungle, Blue Bar and `korcula klubovi` show page-one or near-page-one visibility with low CTR.
- Moreška page: 160 impressions, 1.25% CTR, position 7.57.

## Changes made from this baseline

- Shortened and differentiated the Oliver, nightlife, and bars/clubs guide metadata.
- Replaced search-engine-facing copy in guide introductions with visitor-facing language.
- Added focused metadata overrides for the strongest page-one event opportunities:
  - Oliver memorial and ferry concerts.
  - Moreška.
  - Boogie Jungle.
  - Dos Locos.
  - Blue Bar / Blue Club.
  - Vatra in Lovište.
- Added contextual links from event pages to relevant Oliver, nightlife, bars/clubs, wine, and festival guides.
- Replaced the hard-coded event total on language landing pages with the actual current event count.

## Next measurement

Compare a new Search Console export after at least 14 full days. Prioritise:

1. CTR change for the pages above.
2. Query movement for Oliver, Moreška, Dos Locos, Boogie Jungle, Blue Bar and Korčula clubs/nightlife.
3. Whether `/guides/nightlife-guide/` and `/guides/bars-clubs/` attract more distinct query groups.
4. Mobile CTR and any Search appearance enhancements.

Avoid broad title rewrites until there is enough post-change data to separate trend growth from optimisation impact.

## Google Events enhancement — 25 July 2026

The Search Console Events export showed no invalid items, but recurring non-critical warnings for offers, performer, organizer, end date, image and event status. The implementation now:

- Generates a dedicated leaf page and `Event` entity for every sourced Moreška performance while preserving the existing Moreška umbrella URL as a `CollectionPage`.
- Links the Moreška umbrella page to 12 official performances from 3 August through 14 October 2026.
- Adds the sourced one-hour duration, HGD Sveta Cecilija organizer, performing group, official ticket URL, and adult/child EUR prices to those occurrences.
- Emits a structured `PostalAddress`, scheduled status and image for every individual Event entity.
- Generates a unique 1200 × 675 SVG event image when no poster mapping exists.
- Supports explicit `endTime`, duration-based end times, time ranges, organizer, performers and verified priced offers in the shared event generator.
- Adds the same rich fields to newly extracted official Moreška candidates so later ingestion runs retain the enhancement.
- Keeps unpriced ticket links visible without inventing price or currency Offer data.

Validation after `npm run build`:

- 348 sitemap URLs.
- 296 event page files: 295 individual `Event` entities and one Moreška collection page.
- 295/295 Event entities have `PostalAddress`, image and `eventStatus`.
- 12/12 Moreška occurrence entities have `endDate`, organizer, performer and two verified offers.
- 12 Moreška occurrence URLs are present in the sitemap.
- 87 generated event-image references resolve to generated files.

## Full multilingual and freshness rollout — 25 July 2026

Implemented the next on-site optimization phase across the full event catalogue:

- Added complete public page families in Croatian, English, German, Italian, Slovenian and French.
- Generated translated event leaf pages, event indexes, guides, place pages, category pages and information/legal pages.
- Added reciprocal `hreflang` links to every sitemap page while preserving existing English event URLs.
- Added concise, factual, language-specific fallback descriptions for events without editorial descriptions.
- Added visible source-confidence, organizer, performer, update-date and past-event information where applicable.
- Added durable `updatedAt` values to all events; future ingestion merges set the date automatically.
- Changed the sitemap to emit accurate event `lastmod` values only and removed ignored `priority` and `changefreq`.
- Replaced generated SVG event cards with 1920×1080, 1600×1200 and 1200×1200 WebP variants.
- Removed stale hand-maintained Event entities from the interactive homepage.
- Added an AVIF hero image with WebP fallback and deferred below-the-fold scenic images.
- Added explicit cancelled, postponed, rescheduled and moved-online schema support.

Validated build:

- 2,053 sitemap URLs.
- 1,776 individual event pages across six languages.
- 1,770 eligible Event entities and six Moreška collection pages.
- 14,371 reciprocal `hreflang` links with no missing targets.
- 5,310 Event image references backed by 888 valid WebP variants.
- No broken internal page links or JSON-LD parsing failures.
- Local mobile Lighthouse: SEO 100 for homepage and translated event page; translated event performance 100 with 1.4 s LCP in the validation run.
