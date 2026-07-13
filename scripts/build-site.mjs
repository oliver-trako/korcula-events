import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const siteUrl = "https://korcula-events.com";
const buildDate = new Date().toISOString().slice(0, 10);

const langMeta = {
  hr: {
    name: "Hrvatski",
    title: "Događanja na Korčuli 2026",
    description: "Kalendar koncerata, fešti, folklora, vina, dječjih programa, sporta i noćnog života na otoku Korčuli za ljeto 2026.",
    intro: "Pregled događanja na Korčuli za ljeto 2026., s programima po mjestu, kategoriji i datumu.",
    allEvents: "Sva događanja",
    openCalendar: "Otvori interaktivni kalendar",
    places: "Mjesta",
    categories: "Kategorije",
    source: "Izvor"
  },
  en: {
    name: "English",
    title: "Korčula Events 2026",
    description: "Concerts, festivals, folklore, wine nights, kids' events, sports and nightlife across Korčula island in summer 2026.",
    intro: "A crawlable guide to Korčula island events for summer 2026, organised by date, place and category.",
    allEvents: "All events",
    openCalendar: "Open interactive calendar",
    places: "Places",
    categories: "Categories",
    source: "Source"
  },
  de: {
    name: "Deutsch",
    title: "Veranstaltungen auf Korčula 2026",
    description: "Konzerte, Festivals, Folklore, Weinabende, Kinderprogramme, Sport und Nachtleben auf Korčula im Sommer 2026.",
    intro: "Ein suchmaschinenfreundlicher Überblick über Veranstaltungen auf Korčula im Sommer 2026.",
    allEvents: "Alle Veranstaltungen",
    openCalendar: "Interaktiven Kalender öffnen",
    places: "Orte",
    categories: "Kategorien",
    source: "Quelle"
  },
  it: {
    name: "Italiano",
    title: "Eventi a Curzola 2026",
    description: "Concerti, festival, folklore, serate del vino, eventi per bambini, sport e vita notturna sull'isola di Curzola nell'estate 2026.",
    intro: "Guida indicizzabile agli eventi dell'isola di Curzola per l'estate 2026.",
    allEvents: "Tutti gli eventi",
    openCalendar: "Apri il calendario interattivo",
    places: "Località",
    categories: "Categorie",
    source: "Fonte"
  },
  sl: {
    name: "Slovenščina",
    title: "Dogodki na Korčuli 2026",
    description: "Koncerti, festivali, folklora, vinski večeri, otroški programi, šport in nočno življenje na otoku Korčula poleti 2026.",
    intro: "Pregleden vodnik po dogodkih na Korčuli za poletje 2026.",
    allEvents: "Vsi dogodki",
    openCalendar: "Odpri interaktivni koledar",
    places: "Kraji",
    categories: "Kategorije",
    source: "Vir"
  },
  fr: {
    name: "Français",
    title: "Événements à Korčula 2026",
    description: "Concerts, festivals, folklore, soirées vin, événements enfants, sport et vie nocturne sur l'île de Korčula à l'été 2026.",
    intro: "Guide indexable des événements de l'île de Korčula pour l'été 2026.",
    allEvents: "Tous les événements",
    openCalendar: "Ouvrir le calendrier interactif",
    places: "Lieux",
    categories: "Catégories",
    source: "Source"
  }
};

const catLabels = {
  music: "Music",
  theatre: "Theatre",
  film: "Cinema",
  kids: "Kids",
  sports: "Sports",
  food: "Food and wine",
  folklore: "Folklore",
  religious: "Religious",
  exhibition: "Exhibition",
  literature: "Literature",
  festival: "Festival",
  market: "Market",
  nightlife: "Nightlife"
};

async function copyIfExists(from, to) {
  try {
    await cp(from, to, { recursive: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
}

async function replaceInFile(file, replacements) {
  let text = await readFile(file, "utf8");
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  await writeFile(file, text, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "event";
}

function titleFor(event, lang = "en") {
  if (lang === "hr") return event.hr || event.en || "";
  return event[lang] || event.en || event.hr || "";
}

function descFor(event, lang = "en") {
  if (!event.desc) return "";
  return stripHtml(event.desc[lang] || event.desc.en || event.desc.hr || "");
}

function townName(towns, id, lang = "en") {
  const town = towns.find((x) => x.id === id);
  return town ? (town[lang] || town.en || town.hr || id) : id;
}

function eventUrl(event) {
  return `${siteUrl}/events/${slugify(titleFor(event, "en"))}-${slugify(event.id)}/`;
}

function eventPath(event) {
  return path.join(dist, "events", `${slugify(titleFor(event, "en"))}-${slugify(event.id)}`, "index.html");
}

function categoryUrl(cat) {
  return `${siteUrl}/categories/${slugify(cat)}/`;
}

function placeUrl(townId) {
  return `${siteUrl}/places/${slugify(townId)}/`;
}

function isoDateTime(event, end = false) {
  const date = end && event.endDate ? event.endDate : event.date;
  const match = String(event.time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return date;
  return `${date}T${match[1].padStart(2, "0")}:${match[2]}:00+02:00`;
}

function pageShell({ lang = "en", title, description, canonical, body, schema }) {
  const alternates = Object.keys(langMeta)
    .map((code) => `<link rel="alternate" hreflang="${code}" href="${siteUrl}/${code}/">`)
    .join("\n");
  const schemaHtml = schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : "";
  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
${alternates}
<link rel="stylesheet" href="/css/style.css">
<style>
.seo-page{max-width:900px;margin:0 auto;padding:28px 16px 48px}
.seo-page h1{font-family:var(--font-display);color:var(--sea-deep);font-size:clamp(2rem,5vw,3.5rem);line-height:1;margin:0 0 12px}
.seo-page h2{font-size:1.1rem;color:var(--sea-deep);margin:28px 0 12px}
.seo-page p{color:var(--ink-soft);line-height:1.6}
.seo-nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}
.seo-nav a,.seo-event-list a{color:var(--sea-deeper);font-weight:800;text-decoration:none}
.seo-nav a:hover,.seo-event-list a:hover{text-decoration:underline}
.seo-event-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.seo-event-list li{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px}
.seo-meta{display:block;color:var(--ink-soft);font-size:.88rem;margin-top:4px}
</style>
${schemaHtml}
</head>
<body>
<main class="seo-page">
${body}
</main>
</body>
</html>`;
}

function eventList(events, towns, lang = "en", limit = events.length) {
  return `<ul class="seo-event-list">${events.slice(0, limit).map((event) => {
    const title = titleFor(event, lang);
    const meta = [event.date + (event.endDate ? ` to ${event.endDate}` : ""), event.time, townName(towns, event.town, lang), event.venue].filter(Boolean).join(" · ");
    return `<li><a href="${esc(eventUrl(event))}">${esc(title)}</a><span class="seo-meta">${esc(meta)}</span></li>`;
  }).join("\n")}</ul>`;
}

function eventSchema(event, towns) {
  const description = descFor(event, "en") || `${titleFor(event, "en")} in ${townName(towns, event.town, "en")}, Korčula, Croatia.`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: titleFor(event, "en"),
    startDate: isoDateTime(event),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url: eventUrl(event),
    location: {
      "@type": "Place",
      name: event.venue || townName(towns, event.town, "en"),
      address: `${townName(towns, event.town, "en")}, Croatia`
    },
    description
  };
  if (event.endDate) schema.endDate = isoDateTime(event, true);
  if (/besplatan|slobodan|free/i.test(`${event.hr || ""} ${event.en || ""}`)) schema.isAccessibleForFree = true;
  if (event.ticketUrl) {
    schema.offers = {
      "@type": "Offer",
      url: event.ticketUrl,
      availability: "https://schema.org/InStock"
    };
  }
  if (event.source || event.website || event.facebook) schema.sameAs = [event.source || event.website || event.facebook];
  return schema;
}

async function writePage(file, html) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, "utf8");
}

async function buildSeoPages(data) {
  const towns = data.meta.towns;
  const events = data.events.slice().sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    String(a.time || "").localeCompare(String(b.time || "")) ||
    String(a.id).localeCompare(String(b.id))
  );
  const urls = new Set([`${siteUrl}/`]);

  for (const [lang, meta] of Object.entries(langMeta)) {
    const body = `
      <p><a href="/">${esc(meta.openCalendar)}</a></p>
      <h1>${esc(meta.title)}</h1>
      <p>${esc(meta.intro)}</p>
      <nav class="seo-nav">
        <a href="/events/">${esc(meta.allEvents)}</a>
        <a href="/places/">${esc(meta.places)}</a>
        <a href="/categories/">${esc(meta.categories)}</a>
      </nav>
      <h2>${esc(meta.allEvents)}</h2>
      ${eventList(events, towns, lang, 80)}
    `;
    const url = `${siteUrl}/${lang}/`;
    urls.add(url);
    await writePage(path.join(dist, lang, "index.html"), pageShell({
      lang,
      title: `${meta.title} | Korčula Island Events`,
      description: meta.description,
      canonical: url,
      body,
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: meta.title,
        url,
        inLanguage: lang
      }
    }));
  }

  await writePage(path.join(dist, "events", "index.html"), pageShell({
    title: "All Korčula Events 2026 | Concerts, Festivals, Nightlife and Culture",
    description: "Browse all 2026 Korčula island events by date, including concerts, festivals, folklore, food and wine, kids' activities, sport and nightlife.",
    canonical: `${siteUrl}/events/`,
    body: `
      <p><a href="/">Open interactive calendar</a></p>
      <h1>All Korčula Events 2026</h1>
      <p>Indexable event list for Korčula Town, Lumbarda, Vela Luka, Blato, Smokvica, Račišće, Žrnovo, Čara, Pupnat, Kneže and nearby Orebić.</p>
      ${eventList(events, towns, "en")}
    `,
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "All Korčula Events 2026",
      url: `${siteUrl}/events/`
    }
  }));
  urls.add(`${siteUrl}/events/`);

  for (const event of events) {
    const url = eventUrl(event);
    urls.add(url);
    const title = titleFor(event, "en");
    const town = townName(towns, event.town, "en");
    const description = descFor(event, "en") || `${title} on ${event.date} in ${town}, Korčula, Croatia.`;
    const sourceLinks = [
      ["Website", event.website],
      ["Tickets", event.ticketUrl],
      ["Facebook", event.facebook],
      ["Instagram", event.instagram],
      ["Source", event.source]
    ].filter(([, href]) => href);
    await writePage(eventPath(event), pageShell({
      title: `${title} | Korčula Events 2026`,
      description: description.slice(0, 155),
      canonical: url,
      body: `
        <p><a href="/events/">All events</a> · <a href="/">Interactive calendar</a></p>
        <h1>${esc(title)}</h1>
        <p><strong>Date:</strong> ${esc(event.date)}${event.endDate ? ` to ${esc(event.endDate)}` : ""}${event.time ? ` · ${esc(event.time)}` : ""}</p>
        <p><strong>Place:</strong> ${esc(town)}${event.venue ? ` · ${esc(event.venue)}` : ""}</p>
        <p>${esc(description)}</p>
        <p><strong>Categories:</strong> ${esc((event.cats || []).map((cat) => catLabels[cat] || cat).join(", "))}</p>
        ${event.verify ? "<p>Details are marked for verification. Check the linked source before relying on the exact time.</p>" : ""}
        ${sourceLinks.length ? `<h2>More details</h2><ul>${sourceLinks.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul>` : ""}
      `,
      schema: eventSchema(event, towns)
    }));
  }

  await writePage(path.join(dist, "places", "index.html"), pageShell({
    title: "Korčula Events by Place 2026 | Towns and Villages",
    description: "Browse Korčula island events by town and village, including Korčula Town, Lumbarda, Vela Luka, Blato, Smokvica, Račišće and Orebić.",
    canonical: `${siteUrl}/places/`,
    body: `
      <p><a href="/">Open interactive calendar</a></p>
      <h1>Korčula Events by Place</h1>
      <ul class="seo-event-list">${towns.map((town) => {
        const count = events.filter((event) => event.town === town.id).length;
        return `<li><a href="${esc(placeUrl(town.id))}">${esc(town.en || town.hr)}</a><span class="seo-meta">${count} events</span></li>`;
      }).join("")}</ul>
    `
  }));
  urls.add(`${siteUrl}/places/`);

  for (const town of towns) {
    const townEvents = events.filter((event) => event.town === town.id);
    if (!townEvents.length) continue;
    const url = placeUrl(town.id);
    urls.add(url);
    await writePage(path.join(dist, "places", slugify(town.id), "index.html"), pageShell({
      title: `${town.en || town.hr} Events 2026 | Korčula Island`,
      description: `Concerts, festivals, folklore, food and wine, sport and nightlife in ${town.en || town.hr}, Korčula island, in 2026.`,
      canonical: url,
      body: `
        <p><a href="/places/">All places</a> · <a href="/">Interactive calendar</a></p>
        <h1>${esc(town.en || town.hr)} Events 2026</h1>
        <p>Events and summer programmes in ${esc(town.en || town.hr)}.</p>
        ${eventList(townEvents, towns, "en")}
      `
    }));
  }

  await writePage(path.join(dist, "categories", "index.html"), pageShell({
    title: "Korčula Events by Category 2026 | Music, Festivals, Nightlife",
    description: "Browse Korčula island events by category, including music, folklore, food and wine, kids' events, sport, festivals and nightlife.",
    canonical: `${siteUrl}/categories/`,
    body: `
      <p><a href="/">Open interactive calendar</a></p>
      <h1>Korčula Events by Category</h1>
      <ul class="seo-event-list">${Object.keys(catLabels).map((cat) => {
        const count = events.filter((event) => (event.cats || []).includes(cat)).length;
        return `<li><a href="${esc(categoryUrl(cat))}">${esc(catLabels[cat])}</a><span class="seo-meta">${count} events</span></li>`;
      }).join("")}</ul>
    `
  }));
  urls.add(`${siteUrl}/categories/`);

  for (const cat of Object.keys(catLabels)) {
    const catEvents = events.filter((event) => (event.cats || []).includes(cat));
    if (!catEvents.length) continue;
    const url = categoryUrl(cat);
    urls.add(url);
    await writePage(path.join(dist, "categories", slugify(cat), "index.html"), pageShell({
      title: `Korčula ${catLabels[cat]} Events 2026`,
      description: `Browse ${catLabels[cat].toLowerCase()} events on Korčula island in 2026 by date, town and venue.`,
      canonical: url,
      body: `
        <p><a href="/categories/">All categories</a> · <a href="/">Interactive calendar</a></p>
        <h1>Korčula ${esc(catLabels[cat])} Events 2026</h1>
        ${eventList(catEvents, towns, "en")}
      `
    }));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls).sort().map((url) => `  <url>
    <loc>${esc(url)}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${url === `${siteUrl}/` ? "daily" : "weekly"}</changefreq>
    <priority>${url === `${siteUrl}/` ? "1.0" : "0.7"}</priority>
  </url>`).join("\n")}
</urlset>
`;
  await writeFile(path.join(dist, "sitemap.xml"), sitemap, "utf8");
  return urls.size;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(path.join(root, "site"), dist, { recursive: true });
await copyIfExists(path.join(root, "generated_images"), path.join(dist, "generated_images"));
await copyIfExists(path.join(root, "2026 Events"), path.join(dist, "2026 Events"));

await replaceInFile(path.join(dist, "index.html"), [
  ["../generated_images/", "generated_images/"],
  ["../2026%20Events/", "2026%20Events/"],
  ["../2026 Events/", "2026 Events/"]
]);

await replaceInFile(path.join(dist, "css", "style.css"), [
  ["../../generated_images/", "../generated_images/"]
]);

const data = JSON.parse(await readFile(path.join(root, "site", "data", "events.json"), "utf8"));
const urlCount = await buildSeoPages(data);

console.log(`Built site to dist/ with ${urlCount} sitemap URLs.`);
