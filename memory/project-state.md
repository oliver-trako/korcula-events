# Korcula Calendar Project State

Last updated: 2026-07-09

## Current goal

Polish the static Korcula Island Events website before registering `korcula-events.com` and deploying to free Cloudflare hosting.

## Current structure

- `site/` is the public static website.
- `site/data/events.json` is the current canonical event database.
- `site/data/sources.json` is the source directory for official boards, venues, socials, ticketing, village/community pages, and poster folders.
- `site/data/pending-events.json` is the review queue for discovered event candidates.
- `2026 Events/` contains original flyer/poster images used by the site.
- `scripts/` contains local source-checking, OCR, extraction, and merge helpers.
- `.claude/launch.json` runs the site locally with `npx --yes serve -l 5500 .`.

## Product direction

- Audience: tourists, locals, accommodation hosts, and trip planners.
- Language behavior: prefer browser language on first visit, then persist the user's manual selection.
- Data workflow for now: edit `events.json` directly.
- Future workflow: keep the public suggestion form mailto-based for now, but eventually allow forwarded event emails to a special mailbox that can be processed into website updates.
- UX/SEO are higher priority than infrastructure until the site feels ready.
- Orebić/Pelješac events should remain included, but be visually separated as nearby-by-ferry events.
- Visual direction: avoid emoji/cartoon UI and generic app styling. The site should feel like a lively Korcula summer events guide, using real event poster imagery, mature Adriatic/island colors, sharper controls, and a practical calendar-first layout.
- Color direction: use Korcula civic colors as the base: deep blue field, white/silver stone, and yellow/gold accent, with muted Adriatic teal as a secondary modern-events accent.
- Logo direction: use a simplified Korcula gate/tower plus calendar/event accent. Do not copy the official coat of arms or include St. Mark; keep the official civic symbolism as inspiration only.
- Header direction: lead with the Korcula Events identity, short seasonal copy, search, tabs, and real event visuals while keeping today's events close to the top.
- Generated image assets are copied under project-root `generated_images/` and referenced from the static site because OneDrive placeholder/reparse behavior blocked copying binary files into `site/assets/`. Current active assets:
  - Hero: `C:\Users\oliver\.codex\generated_images\019f4238-0d22-7c61-a5de-d8d8a9751fdf\ig_08cb38e27fc1cd4c016a4e6b76535c8191b68b7bca395d86af.png`
  - Nightlife: `C:\Users\oliver\.codex\generated_images\019f4238-0d22-7c61-a5de-d8d8a9751fdf\ig_08cb38e27fc1cd4c016a4e6be34c5481919c0b794897cb788d.png`
  - Served hero copy: `generated_images/019f4238-0d22-7c61-a5de-d8d8a9751fdf/ig_08cb38e27fc1cd4c016a4e6b76535c8191b68b7bca395d86af.png`
  - Served nightlife copy: `generated_images/019f4238-0d22-7c61-a5de-d8d8a9751fdf/ig_08cb38e27fc1cd4c016a4e6be34c5481919c0b794897cb788d.png`

## Deployment notes

- `korcula-events.com` still needs to be registered.
- Target hosting is Cloudflare's free static hosting path once the website is approved.
- Do not assume domain, Cloudflare project, or DNS already exists.
- Static hosting alone will not run scrapers; scheduled checks require Cloudflare Workers Cron or an external/local runner.

## Data quality notes

- `events.json` was generated on 2026-07-08.
- Entries with `verify: true` need source confirmation before being treated as firm.
- When adding event web/social links, use optional fields on events:
  - `website`
  - `facebook`
  - `instagram`
  - `ticketUrl`
  - `source`
