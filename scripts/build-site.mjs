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

const infoPages = {
  about: {
    title: "About Korčula Island Events",
    description: "About Korčula Island Events, an independent event calendar for Korčula island and nearby Orebić.",
    h1: "About Korčula Island Events",
    body: `
      <p>Korčula Island Events is an independent calendar for visitors, locals, accommodation hosts and trip planners looking for concerts, festivals, folklore, food and wine, sport, kids' activities and nightlife across Korčula island.</p>
      <p>The calendar combines official tourist-board programmes, event posters, venue pages and community sources. Events marked for verification should be checked with the linked source before relying on exact details.</p>
      <p><a href="/">Open the interactive calendar</a> or browse <a href="/events/">all event pages</a>.</p>
    `
  },
  contact: {
    title: "Contact Korčula Island Events",
    description: "Contact Korčula Island Events to suggest a listing correction, submit a new event, or share a useful event source.",
    h1: "Contact",
    body: `
      <p>Use this form to suggest a new event, correct an existing listing, share a poster, or recommend a useful source for Korčula island events.</p>
      <form class="seo-form" action="mailto:events@korcula-events.com" method="post" enctype="text/plain">
        <label><span>Your name</span><input name="name" autocomplete="name"></label>
        <label><span>Your email</span><input name="email" type="email" autocomplete="email"></label>
        <label><span>Subject</span><input name="subject" required placeholder="Event submission, correction, or source suggestion"></label>
        <label><span>Message</span><textarea name="message" rows="6" required placeholder="Include event name, date, time, venue, town, source link and poster details if available."></textarea></label>
        <button type="submit">Send message</button>
      </form>
      <p class="seo-small">The form opens your email app and sends to the public site mailbox. A direct server-side form can be added later once the mailbox or form endpoint is configured.</p>
    `
  },
  privacy: {
    title: "Privacy Policy | Korčula Island Events",
    description: "Privacy policy for Korčula Island Events, including analytics, local storage and event submissions.",
    h1: "Privacy Policy",
    body: `
      <p>Korčula Island Events is designed as a public information website. You can browse the calendar without creating an account.</p>
      <h2>Information we process</h2>
      <p>The site may use privacy-friendly analytics provided by Cloudflare Web Analytics to understand aggregate visits and page performance. The language selection and cookie notice preference are stored in your browser using local storage.</p>
      <p>If you submit an event or contact us by email, the details you provide may be used to review, verify and publish event information.</p>
      <h2>What we do not do</h2>
      <p>We do not run advertising cookies, sell visitor data, or require user accounts.</p>
      <h2>Contact</h2>
      <p>For privacy questions or corrections, use the <a href="/contact/">contact form</a>.</p>
    `
  },
  terms: {
    title: "Terms and Conditions | Korčula Island Events",
    description: "Terms and conditions for using Korčula Island Events.",
    h1: "Terms and Conditions",
    body: `
      <p>Korčula Island Events is provided as a public event guide. We aim to keep listings useful and current, but event dates, times, venues, ticketing and availability can change.</p>
      <p>Always check the linked source, venue, organiser or tourist-board page before making travel, ticketing or attendance decisions.</p>
      <p>External links are provided for convenience. We are not responsible for the content, availability or policies of third-party websites.</p>
      <p>By using the site, you accept that the calendar is informational and provided without guarantees of completeness or accuracy.</p>
    `
  },
  cookies: {
    title: "Cookie Policy | Korčula Island Events",
    description: "Cookie and local storage policy for Korčula Island Events.",
    h1: "Cookie Policy",
    body: `
      <p>This site keeps cookies and browser storage minimal.</p>
      <h2>Essential browser storage</h2>
      <p>The site stores your selected language and whether you dismissed the cookie notice in your browser. This helps the calendar remember your preferences.</p>
      <h2>Analytics</h2>
      <p>The site may use Cloudflare Web Analytics to measure aggregate traffic and performance. It is intended to be privacy-friendly and does not use advertising tracking.</p>
      <h2>Advertising cookies</h2>
      <p>We do not currently use advertising cookies or behavioural ad tracking.</p>
    `
  },
  sitemap: {
    title: "Site Map | Korčula Island Events",
    description: "A human-readable site map for Korčula Island Events.",
    h1: "Site Map",
    body: `
      <p>Use this page to jump to the main sections of Korčula Island Events.</p>
      <div class="seo-grid">
        <div class="seo-card"><strong>Calendar</strong><a href="/">Interactive event calendar</a></div>
        <div class="seo-card"><strong>Events</strong><a href="/events/">All event pages</a></div>
        <div class="seo-card"><strong>Places</strong><a href="/places/">Events by town and village</a></div>
        <div class="seo-card"><strong>Categories</strong><a href="/categories/">Events by category</a></div>
        <div class="seo-card"><strong>Contact</strong><a href="/contact/">Submit an event or correction</a></div>
        <div class="seo-card"><strong>Search engines</strong><a href="/sitemap.xml">XML sitemap</a></div>
      </div>
    `
  }
};

const eventTranslationRules = {
  de: [
    ["\"Kids, Let's Play!\" — Croatian Red Cross children's day camp", "\"Kinder, lasst uns spielen!\" — Tagescamp des Kroatischen Roten Kreuzes"],
    ["Beach games with Lumpar", "Strandspiele mit Lumpar"],
    ["Blue Bar / Blue Club — rotating DJ nights", "Blue Bar / Blue Club — wechselnde DJ-Abende"],
    ["La Banya — weekly \"Disco Aperitivo Monday\" and live jazz evenings", "La Banya — wöchentlicher \"Disco Aperitivo Monday\" und Live-Jazz-Abende"],
    ["Konoba Casablanca — waterfront bar that turns into a club after midnight", "Konoba Casablanca — Bar an der Uferpromenade, die nach Mitternacht zum Club wird"],
    ["Korčula Island", "Insel Korčula"],
    ["Korčula's Wooden Shipbuilding", "Korčulas Holzschiffbau"],
    ["Summer in", "Sommer in"],
    ["Summer Festival", "Sommerfestival"],
    ["historic sword dance", "historischer Schwerttanz"],
    ["traditional sword dance", "traditioneller Schwerttanz"],
    ["Sword Dance Festival", "Schwerttanzfestival"],
    ["Wine Festival", "Weinfestival"],
    ["Wine Night", "Weinabend"],
    ["Food & Wine", "Essen & Wein"],
    ["Food and wine", "Essen und Wein"],
    ["Classical concert", "Klassisches Konzert"],
    ["Concert:", "Konzert:"],
    ["Concert —", "Konzert —"],
    ["Cinema:", "Kino:"],
    ["Mediterranean Cinema:", "Kino Mediteran:"],
    ["Mediterranean Kino:", "Kino Mediteran:"],
    ["Exhibition:", "Ausstellung:"],
    ["Painting exhibition:", "Gemäldeausstellung:"],
    ["Exhibition of", "Ausstellung von"],
    ["paintings & sketches", "Gemälde und Skizzen"],
    ["By the Sea", "Am Meer"],
    ["Lecture:", "Vortrag:"],
    ["Book presentation:", "Buchvorstellung:"],
    ["Puppet show:", "Puppentheater:"],
    ["Children's theatre:", "Kindertheater:"],
    ["Children's play", "Kindertheaterstück"],
    ["Theatre play:", "Theaterstück:"],
    ["Comedy play", "Komödie"],
    ["Stand-up comedy:", "Stand-up-Comedy:"],
    ["Sensory screening:", "Sensorische Vorführung:"],
    ["workshop for children", "Workshop für Kinder"],
    ["workshop", "Workshop"],
    ["for children", "für Kinder"],
    ["children's", "Kinder-"],
    ["kids", "Kinder"],
    ["tournament", "Turnier"],
    ["football tournament", "Fußballturnier"],
    ["bocce tournament", "Boule-Turnier"],
    ["chess tournament", "Schachturnier"],
    ["charity football match", "Benefiz-Fußballspiel"],
    ["Folklore Evening", "Folkloreabend"],
    ["Folklore evening", "Folkloreabend"],
    ["Local village feast", "Lokales Dorffest"],
    ["Village Day", "Dorftag"],
    ["Feast Day", "Festtag"],
    ["Feast of", "Fest des"],
    ["nightlife programme", "Abendprogramm"],
    ["regular DJ nights", "regelmäßige DJ-Abende"],
    ["near-nightly DJ sets", "DJ-Sets fast jeden Abend"],
    ["open-air club", "Open-Air-Club"],
    ["live music", "Livemusik"],
    ["free entry", "freier Eintritt"],
    ["comedy", "Komödie"],
    ["synced", "synchronisiert"],
    ["weekly", "wöchentlich"],
    ["evening", "Abend"],
    ["traditional gastronomic event", "traditionelles Gastronomie-Fest"],
    ["Tastes & Scents of the Homeland", "Geschmäcker und Düfte der Heimat"],
    ["Days of", "Tage von"],
    ["Night of", "Nacht der"],
    ["Festival of", "Festival der"]
  ],
  it: [
    ["\"Kids, Let's Play!\" — Croatian Red Cross children's day camp", "\"Bambini, giochiamo!\" — centro diurno della Croce Rossa croata"],
    ["Beach games with Lumpar", "Giochi in spiaggia con Lumpar"],
    ["Blue Bar / Blue Club — rotating DJ nights", "Blue Bar / Blue Club — serate DJ a rotazione"],
    ["La Banya — weekly \"Disco Aperitivo Monday\" and live jazz evenings", "La Banya — \"Disco Aperitivo Monday\" settimanale e serate jazz dal vivo"],
    ["Konoba Casablanca — waterfront bar that turns into a club after midnight", "Konoba Casablanca — bar sul lungomare che dopo mezzanotte diventa club"],
    ["Korčula Island", "Isola di Korčula"],
    ["Korčula's Wooden Shipbuilding", "Costruzione navale in legno di Korčula"],
    ["Summer in", "Estate a"],
    ["Summer Festival", "Festival estivo"],
    ["historic sword dance", "danza storica delle spade"],
    ["traditional sword dance", "danza tradizionale delle spade"],
    ["Sword Dance Festival", "Festival delle danze con le spade"],
    ["Wine Festival", "Festival del vino"],
    ["Wine Night", "Serata del vino"],
    ["Food & Wine", "Cibo e vino"],
    ["Food and wine", "Cibo e vino"],
    ["Classical concert", "Concerto di musica classica"],
    ["Concert:", "Concerto:"],
    ["Concert —", "Concerto —"],
    ["Cinema:", "Cinema:"],
    ["Mediterranean Cinema:", "Cinema Mediterraneo:"],
    ["Mediterranean Cinema:", "Cinema Mediterraneo:"],
    ["Exhibition:", "Mostra:"],
    ["Painting exhibition:", "Mostra di pittura:"],
    ["Exhibition of", "Mostra di"],
    ["paintings & sketches", "dipinti e schizzi"],
    ["By the Sea", "Sul mare"],
    ["Lecture:", "Conferenza:"],
    ["Book presentation:", "Presentazione del libro:"],
    ["Puppet show:", "Spettacolo di burattini:"],
    ["Children's theatre:", "Teatro per bambini:"],
    ["Children's play", "Spettacolo per bambini"],
    ["Theatre play:", "Spettacolo teatrale:"],
    ["Comedy play", "Commedia"],
    ["Stand-up comedy:", "Cabaret:"],
    ["Sensory screening:", "Proiezione sensoriale:"],
    ["workshop for children", "laboratorio per bambini"],
    ["workshop", "laboratorio"],
    ["for children", "per bambini"],
    ["children's", "per bambini"],
    ["kids", "bambini"],
    ["tournament", "torneo"],
    ["football tournament", "torneo di calcio"],
    ["bocce tournament", "torneo di bocce"],
    ["chess tournament", "torneo di scacchi"],
    ["charity football match", "partita di calcio benefica"],
    ["Folklore Evening", "Serata folkloristica"],
    ["Folklore evening", "Serata folkloristica"],
    ["Local village feast", "Festa locale del paese"],
    ["Village Day", "Giornata del paese"],
    ["Feast Day", "Festa patronale"],
    ["Feast of", "Festa di"],
    ["nightlife programme", "programma serale"],
    ["regular DJ nights", "serate DJ regolari"],
    ["near-nightly DJ sets", "DJ set quasi ogni sera"],
    ["open-air club", "club all'aperto"],
    ["live music", "musica dal vivo"],
    ["free entry", "ingresso libero"],
    ["comedy", "commedia"],
    ["synced", "doppiato"],
    ["weekly", "settimanale"],
    ["evening", "sera"],
    ["traditional gastronomic event", "evento gastronomico tradizionale"],
    ["Tastes & Scents of the Homeland", "Sapori e profumi della patria"],
    ["Days of", "Giornate di"],
    ["Night of", "Notte di"],
    ["Festival of", "Festival di"]
  ],
  sl: [
    ["\"Kids, Let's Play!\" — Croatian Red Cross children's day camp", "\"Otroci, pojdimo se igrat!\" — dnevni tabor Hrvaškega Rdečega križa"],
    ["Beach games with Lumpar", "Igre na plaži z Lumparjem"],
    ["Blue Bar / Blue Club — rotating DJ nights", "Blue Bar / Blue Club — izmenični DJ večeri"],
    ["La Banya — weekly \"Disco Aperitivo Monday\" and live jazz evenings", "La Banya — tedenski \"Disco Aperitivo Monday\" in večeri jazza v živo"],
    ["Konoba Casablanca — waterfront bar that turns into a club after midnight", "Konoba Casablanca — bar ob obali, ki se po polnoči spremeni v klub"],
    ["Korčula Island", "Otok Korčula"],
    ["Korčula's Wooden Shipbuilding", "Korčulanska lesena ladjedelništvo"],
    ["Summer in", "Poletje v"],
    ["Summer Festival", "Poletni festival"],
    ["historic sword dance", "zgodovinski ples z meči"],
    ["traditional sword dance", "tradicionalni ples z meči"],
    ["Sword Dance Festival", "Festival plesov z meči"],
    ["Wine Festival", "Vinski festival"],
    ["Wine Night", "Vinski večer"],
    ["Food & Wine", "Hrana in vino"],
    ["Food and wine", "Hrana in vino"],
    ["Classical concert", "Koncert klasične glasbe"],
    ["Concert:", "Koncert:"],
    ["Concert —", "Koncert —"],
    ["Cinema:", "Kino:"],
    ["Mediterranean Cinema:", "Kino Mediteran:"],
    ["Mediterranean Kino:", "Kino Mediteran:"],
    ["Exhibition:", "Razstava:"],
    ["Painting exhibition:", "Razstava slik:"],
    ["Exhibition of", "Razstava"],
    ["paintings & sketches", "slik in skic"],
    ["By the Sea", "Ob morju"],
    ["Lecture:", "Predavanje:"],
    ["Book presentation:", "Predstavitev knjige:"],
    ["Puppet show:", "Lutkovna predstava:"],
    ["Children's theatre:", "Otroška gledališka predstava:"],
    ["Children's play", "Otroška predstava"],
    ["Theatre play:", "Gledališka predstava:"],
    ["Comedy play", "Komedija"],
    ["Stand-up comedy:", "Stand-up komedija:"],
    ["Sensory screening:", "Senzorna projekcija:"],
    ["workshop for children", "delavnica za otroke"],
    ["workshop", "delavnica"],
    ["for children", "za otroke"],
    ["children's", "otroški"],
    ["kids", "otroci"],
    ["tournament", "turnir"],
    ["football tournament", "nogometni turnir"],
    ["bocce tournament", "turnir v balinanju"],
    ["chess tournament", "šahovski turnir"],
    ["charity football match", "dobrodelna nogometna tekma"],
    ["Folklore Evening", "Folklorni večer"],
    ["Folklore evening", "Folklorni večer"],
    ["Local village feast", "Lokalna vaška fešta"],
    ["Village Day", "Dan kraja"],
    ["Feast Day", "Praznik"],
    ["Feast of", "Praznik"],
    ["nightlife programme", "večerni program"],
    ["regular DJ nights", "redni DJ večeri"],
    ["near-nightly DJ sets", "DJ seti skoraj vsak večer"],
    ["open-air club", "klub na prostem"],
    ["live music", "glasba v živo"],
    ["free entry", "prost vstop"],
    ["comedy", "komedija"],
    ["synced", "sinhronizirano"],
    ["weekly", "tedensko"],
    ["evening", "večer"],
    ["traditional gastronomic event", "tradicionalna gastronomska prireditev"],
    ["Tastes & Scents of the Homeland", "Okusi in vonji domačega kraja"],
    ["Days of", "Dnevi"],
    ["Night of", "Noč"],
    ["Festival of", "Festival"]
  ],
  fr: [
    ["\"Kids, Let's Play!\" — Croatian Red Cross children's day camp", "\"Les enfants, allons jouer !\" — camp de jour de la Croix-Rouge croate"],
    ["Beach games with Lumpar", "Jeux de plage avec Lumpar"],
    ["Blue Bar / Blue Club — rotating DJ nights", "Blue Bar / Blue Club — soirées DJ tournantes"],
    ["La Banya — weekly \"Disco Aperitivo Monday\" and live jazz evenings", "La Banya — \"Disco Aperitivo Monday\" hebdomadaire et soirées jazz live"],
    ["Konoba Casablanca — waterfront bar that turns into a club after midnight", "Konoba Casablanca — bar du front de mer qui devient club après minuit"],
    ["Korčula Island", "Île de Korčula"],
    ["Korčula's Wooden Shipbuilding", "Construction navale en bois de Korčula"],
    ["Summer in", "Été à"],
    ["Summer Festival", "Festival d'été"],
    ["historic sword dance", "danse historique des épées"],
    ["traditional sword dance", "danse traditionnelle des épées"],
    ["Sword Dance Festival", "Festival des danses aux épées"],
    ["Wine Festival", "Festival du vin"],
    ["Wine Night", "Soirée du vin"],
    ["Food & Wine", "Gastronomie et vin"],
    ["Food and wine", "Gastronomie et vin"],
    ["Classical concert", "Concert de musique classique"],
    ["Concert:", "Concert :"],
    ["Concert —", "Concert —"],
    ["Cinema:", "Cinéma :"],
    ["Mediterranean Cinema:", "Cinéma méditerranéen :"],
    ["Mediterranean Cinéma :", "Cinéma méditerranéen :"],
    ["Exhibition:", "Exposition :"],
    ["Painting exhibition:", "Exposition de peinture :"],
    ["Exhibition of", "Exposition de"],
    ["paintings & sketches", "peintures et croquis"],
    ["By the Sea", "Au bord de la mer"],
    ["Lecture:", "Conférence :"],
    ["Book presentation:", "Présentation du livre :"],
    ["Puppet show:", "Spectacle de marionnettes :"],
    ["Children's theatre:", "Théâtre pour enfants :"],
    ["Children's play", "Spectacle pour enfants"],
    ["Theatre play:", "Pièce de théâtre :"],
    ["Comedy play", "Comédie"],
    ["Stand-up comedy:", "Stand-up :"],
    ["Sensory screening:", "Projection sensorielle :"],
    ["workshop for children", "atelier pour enfants"],
    ["workshop", "atelier"],
    ["for children", "pour enfants"],
    ["children's", "pour enfants"],
    ["kids", "enfants"],
    ["tournament", "tournoi"],
    ["football tournament", "tournoi de football"],
    ["bocce tournament", "tournoi de pétanque"],
    ["chess tournament", "tournoi d'échecs"],
    ["charity football match", "match de football caritatif"],
    ["Folklore Evening", "Soirée folklorique"],
    ["Folklore evening", "Soirée folklorique"],
    ["Local village feast", "Fête locale du village"],
    ["Village Day", "Journée du village"],
    ["Feast Day", "Fête patronale"],
    ["Feast of", "Fête de"],
    ["nightlife programme", "programme de soirée"],
    ["regular DJ nights", "soirées DJ régulières"],
    ["near-nightly DJ sets", "DJ sets presque tous les soirs"],
    ["open-air club", "club en plein air"],
    ["live music", "musique live"],
    ["free entry", "entrée libre"],
    ["comedy", "comédie"],
    ["synced", "doublé"],
    ["weekly", "hebdomadaire"],
    ["evening", "soirée"],
    ["traditional gastronomic event", "événement gastronomique traditionnel"],
    ["Tastes & Scents of the Homeland", "Saveurs et parfums du terroir"],
    ["Days of", "Journées de"],
    ["Night of", "Nuit de"],
    ["Festival of", "Festival de"]
  ]
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

function translateEventText(text, lang = "en") {
  if (!text || lang === "en" || lang === "hr" || !eventTranslationRules[lang]) return text || "";
  let out = text;
  for (const [from, to] of eventTranslationRules[lang]) {
    out = out.split(from).join(to);
  }
  return out;
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
  if (event[lang]) return event[lang];
  return translateEventText(event.en || event.hr || "", lang);
}

function descFor(event, lang = "en") {
  if (!event.desc) return "";
  const direct = event.desc[lang] || event.desc.en || event.desc.hr || "";
  return stripHtml(event.desc[lang] ? direct : translateEventText(direct, lang));
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
.seo-header{max-width:960px;margin:0 auto;padding:20px 16px 0}
.seo-header-inner{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:var(--shadow)}
.seo-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--sea-deeper)}
.seo-brand img{width:48px;height:48px;border-radius:10px}
.seo-brand strong{font-family:var(--font-display);font-size:1.15rem;line-height:1}
.seo-top-nav{display:flex;gap:12px;flex-wrap:wrap;font-size:.84rem}
.seo-top-nav a{color:var(--sea-deeper);font-weight:800;text-decoration:none}
.seo-top-nav a:hover{text-decoration:underline}
.seo-page{max-width:900px;margin:0 auto;padding:28px 16px 48px}
.seo-hero{background:#fff;border:1px solid var(--border);border-radius:12px;padding:22px;margin-bottom:18px;box-shadow:var(--shadow)}
.seo-page h1{font-family:var(--font-display);color:var(--sea-deep);font-size:clamp(2rem,5vw,3.5rem);line-height:1;margin:0 0 12px}
.seo-page h2{font-size:1.1rem;color:var(--sea-deep);margin:28px 0 12px}
.seo-page p{color:var(--ink-soft);line-height:1.6}
.seo-lede{font-size:1.03rem;max-width:68ch}
.seo-nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}
.seo-nav a,.seo-event-list a{color:var(--sea-deeper);font-weight:800;text-decoration:none}
.seo-nav a:hover,.seo-event-list a:hover{text-decoration:underline}
.seo-event-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.seo-event-list li{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px}
.seo-meta{display:block;color:var(--ink-soft);font-size:.88rem;margin-top:4px}
.seo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}
.seo-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px}
.seo-card strong{display:block;color:var(--sea-deep);margin-bottom:4px}
.seo-form{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;display:grid;gap:12px;margin-top:14px;box-shadow:var(--shadow)}
.seo-form label{display:grid;gap:5px;color:var(--ink);font-size:.86rem;font-weight:800}
.seo-form input,.seo-form textarea{font:inherit;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--sand)}
.seo-form button{justify-self:start;background:var(--sea-deep);color:#fff;border:none;border-radius:8px;padding:11px 15px;font:inherit;font-weight:800;cursor:pointer}
.seo-small{font-size:.82rem}
.seo-footer{max-width:960px;margin:0 auto 24px;padding:0 16px}
@media(max-width:640px){.seo-header-inner{align-items:flex-start;flex-direction:column}.seo-grid{grid-template-columns:1fr}.seo-top-nav{gap:9px}}
</style>
${schemaHtml}
</head>
<body>
<header class="seo-header">
  <div class="seo-header-inner">
    <a class="seo-brand" href="/">
      <img src="/assets/logo-korcula-events.svg" alt="">
      <strong>Korčula Island Events</strong>
    </a>
    <nav class="seo-top-nav" aria-label="Main navigation">
      <a href="/">Calendar</a>
      <a href="/events/">Events</a>
      <a href="/places/">Places</a>
      <a href="/categories/">Categories</a>
      <a href="/contact/">Contact</a>
    </nav>
  </div>
</header>
<main class="seo-page">
${body}
</main>
<footer class="seo-footer">
  <div class="footer-shell">
    <div class="footer-brand">
      <img class="footer-mark" src="/assets/logo-korcula-events.svg" alt="" aria-hidden="true">
      <div>
        <strong>Korčula Island Events</strong>
        <p class="footer-note">A practical, independent guide to concerts, festivals, folklore, food, sport and nightlife across Korčula island.</p>
      </div>
    </div>
    <div class="footer-columns">
      <nav class="footer-nav" aria-label="Browse">
        <strong>Browse</strong>
        <a href="/events/">All events</a>
        <a href="/places/">Places</a>
        <a href="/categories/">Categories</a>
        <a href="/categories/nightlife/">Nightlife</a>
      </nav>
      <nav class="footer-nav" aria-label="Information">
        <strong>Info</strong>
        <a href="/about/">About</a>
        <a href="/contact/">Contact</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/cookies/">Cookies</a>
        <a href="/sitemap/">Site map</a>
      </nav>
    </div>
  </div>
</footer>
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
      <section class="seo-hero">
        <p><a href="/">${esc(meta.openCalendar)}</a></p>
        <h1>${esc(meta.title)}</h1>
        <p class="seo-lede">${esc(meta.intro)}</p>
        <div class="seo-grid">
          <div class="seo-card"><strong>279 events</strong><span>Concerts, feasts, culture, sports and nightlife.</span></div>
          <div class="seo-card"><strong>Island wide</strong><span>Korčula Town, villages, Vela Luka, Lumbarda and nearby Orebić.</span></div>
          <div class="seo-card"><strong>Updated sources</strong><span>Official programmes, posters, venues and community leads.</span></div>
        </div>
      </section>
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
      <section class="seo-hero">
        <p><a href="/">Open interactive calendar</a></p>
        <h1>All Korčula Events 2026</h1>
        <p class="seo-lede">Browse the full summer calendar for Korčula island, from Moreška and village feasts to wine nights, children's events, sport, open-air concerts and beach clubs.</p>
        <div class="seo-grid">
          <div class="seo-card"><strong>Search intent</strong><span>Built for visitors looking for what is on today, this week and this summer.</span></div>
          <div class="seo-card"><strong>Local coverage</strong><span>Includes main towns, smaller villages and nearby Orebić/Pelješac by ferry.</span></div>
          <div class="seo-card"><strong>Source links</strong><span>Events include venue, organiser or tourist-board links where available.</span></div>
        </div>
      </section>
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

  for (const [slug, page] of Object.entries(infoPages)) {
    const url = `${siteUrl}/${slug}/`;
    urls.add(url);
    await writePage(path.join(dist, slug, "index.html"), pageShell({
      title: page.title,
      description: page.description,
      canonical: url,
      body: `
        <p><a href="/">Open interactive calendar</a></p>
        <h1>${esc(page.h1)}</h1>
        ${page.body}
      `,
      schema: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: page.h1,
        url
      }
    }));
  }

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
        <section class="seo-hero">
          <p><a href="/events/">All events</a> · <a href="/">Interactive calendar</a></p>
          <h1>${esc(title)}</h1>
          <p class="seo-lede">${esc(description)}</p>
          <div class="seo-grid">
            <div class="seo-card"><strong>Date</strong><span>${esc(event.date)}${event.endDate ? ` to ${esc(event.endDate)}` : ""}${event.time ? ` · ${esc(event.time)}` : ""}</span></div>
            <div class="seo-card"><strong>Place</strong><span>${esc(town)}${event.venue ? ` · ${esc(event.venue)}` : ""}</span></div>
            <div class="seo-card"><strong>Category</strong><span>${esc((event.cats || []).map((cat) => catLabels[cat] || cat).join(", "))}</span></div>
          </div>
        </section>
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
      <section class="seo-hero">
        <p><a href="/">Open interactive calendar</a></p>
        <h1>Korčula Events by Place</h1>
        <p class="seo-lede">Find events by town, village and nearby ferry destination. This helps visitors plan around where they are staying and how far they want to travel.</p>
      </section>
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
        <section class="seo-hero">
          <p><a href="/places/">All places</a> · <a href="/">Interactive calendar</a></p>
          <h1>${esc(town.en || town.hr)} Events 2026</h1>
          <p class="seo-lede">Events and summer programmes in ${esc(town.en || town.hr)}, including cultural evenings, music, food, sport and seasonal village programmes where available.</p>
        </section>
        ${eventList(townEvents, towns, "en")}
      `
    }));
  }

  await writePage(path.join(dist, "categories", "index.html"), pageShell({
    title: "Korčula Events by Category 2026 | Music, Festivals, Nightlife",
    description: "Browse Korčula island events by category, including music, folklore, food and wine, kids' events, sport, festivals and nightlife.",
    canonical: `${siteUrl}/categories/`,
    body: `
      <section class="seo-hero">
        <p><a href="/">Open interactive calendar</a></p>
        <h1>Korčula Events by Category</h1>
        <p class="seo-lede">Browse the island calendar by activity type, from music and folklore to family events, sport, nightlife, cinema and food and wine.</p>
      </section>
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
        <section class="seo-hero">
          <p><a href="/categories/">All categories</a> · <a href="/">Interactive calendar</a></p>
          <h1>Korčula ${esc(catLabels[cat])} Events 2026</h1>
          <p class="seo-lede">A focused list of ${esc(catLabels[cat].toLowerCase())} events across Korčula island, sorted by date and linked back to source details where available.</p>
        </section>
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
