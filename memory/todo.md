# Korcula Calendar TODO

Last updated: 2026-07-09

## Source and Event Intake

- Create `site/data/sources.json` as a directory of official boards, venues, cultural organisers, nightlife venues, ticketing platforms, and useful social pages.
- Seed sources from existing `events.json` links and known high-priority venues: Blue Bar / Blue Club, Boogie Jungle, La Banya, Prvi Zal, Moreška, Korčula tourist board, Lumbarda tourist board, Vela Luka tourist board, Blato tourist board, Smokvica / Brna sources, and Orebić / Pelješac sources.
- Continue source discovery for restaurants, wineries, KUDs, sports clubs, parish/local feast pages, hotels, and informal Facebook groups not yet captured.
- Audit source coverage by town after each expansion pass and add missing village/community leads.
- Add `sourceId` to events where the origin is known.
- Create `site/data/pending-events.json` for discovered-but-not-approved events.
- Build a local review workflow so discovered events are approved before publication.
- Use `site/data/ingestion-policy.json` to auto-approve complete structured events from reliable high-confidence sources, while requiring human review for social/OCR/search/community leads.
- Once in GitHub, enable `.github/workflows/event-ingestion.yml` and confirm it can create pull requests.
- Add scripts for source checking:
  - `scripts/check-sources.ps1`
  - `scripts/extract-event-candidates.ps1`
  - `scripts/merge-approved-events.ps1`
- Add a simple `/review.html` or `/admin.html` page for reviewing pending events locally.
- Keep social media scraping as a lead-generation workflow only; do not auto-publish social posts directly to the live calendar.
- Investigate email-forwarding intake: forwarded event submissions to a special mailbox should become pending event candidates.

## Automation / Hosting

- Keep the public site static for launch if possible.
- For scheduled source checks on Cloudflare, use a separate Cloudflare Worker with Cron Triggers rather than expecting static hosting alone to run scrapers.
- Store generated candidates in KV, D1, R2, or a repository-backed workflow depending on the final deployment model.
- Respect free-plan limits before enabling frequent checks; prioritize high-value sources first.
