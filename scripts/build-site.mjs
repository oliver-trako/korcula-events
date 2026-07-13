import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const siteUrl = "https://korcula-events.com";
const buildDate = new Date().toISOString().slice(0, 10);
const defaultShareImage = `${siteUrl}/generated_images/019f4238-0d22-7c61-a5de-d8d8a9751fdf/ig_08cb38e27fc1cd4c016a4e6b76535c8191b68b7bca395d86af.png`;

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
        <div class="seo-card"><strong>Guides</strong><a href="/guides/">Planning guides</a></div>
        <div class="seo-card"><strong>Places</strong><a href="/places/">Events by town and village</a></div>
        <div class="seo-card"><strong>Categories</strong><a href="/categories/">Events by category</a></div>
        <div class="seo-card"><strong>Contact</strong><a href="/contact/">Submit an event or correction</a></div>
        <div class="seo-card"><strong>Search engines</strong><a href="/sitemap.xml">XML sitemap</a></div>
      </div>
    `
  }
};

const guidePages = {
  "tonight": {
    title: "Things to Do in Korčula Tonight | Events This Evening",
    h1: "Things to Do in Korčula Tonight",
    description: "Find concerts, cinema, folklore, nightlife and family events happening tonight on Korčula island.",
    intro: "A focused guide for visitors already on the island who want to know what is happening tonight, from early-evening culture to late-night beach clubs.",
    filter: (event, ctx) => occursOnDate(event, ctx.today)
  },
  "this-week": {
    title: "Korčula Events This Week | Concerts, Festivals and Nightlife",
    h1: "Korčula Events This Week",
    description: "See what is on this week on Korčula island, including concerts, festivals, theatre, family events and nightlife.",
    intro: "Plan the next few days on Korčula with a week-ahead view of concerts, village programmes, family activities, sport, food and nightlife.",
    filter: (event, ctx) => dateInRange(event.date, ctx.today, ctx.weekEnd) || (event.endDate && dateRangesOverlap(event.date, event.endDate, ctx.today, ctx.weekEnd))
  },
  "nightlife-guide": {
    title: "Korčula Nightlife Guide 2026 | Beach Clubs, Bars and DJ Nights",
    h1: "Korčula Nightlife Guide 2026",
    description: "Korčula nightlife guide covering beach clubs, DJ nights, late bars and summer party events.",
    intro: "Korčula nightlife is split between waterfront bars, old-town spots, beach venues and open-air summer clubs. This guide highlights the recurring nightlife programmes and dated party events currently in the calendar.",
    filter: (event) => (event.cats || []).includes("nightlife")
  },
  "kids-family": {
    title: "Korčula with Kids 2026 | Family Events and Children’s Activities",
    h1: "Korčula with Kids",
    description: "Family-friendly Korčula events including kids' theatre, cinema, workshops, games and activities.",
    intro: "Family events on Korčula include open-air cinema, children's theatre, workshops, beach games, village activities and sports programmes.",
    filter: (event) => (event.cats || []).includes("kids")
  },
  "summer-festivals": {
    title: "Best Summer Festivals on Korčula 2026",
    h1: "Best Summer Festivals on Korčula",
    description: "A guide to Korčula summer festivals, village feasts, folklore, wine nights, music festivals and seasonal programmes.",
    intro: "Korčula's summer calendar is built around village feasts, folklore, wine nights, open-air music, sword-dance traditions and seasonal cultural programmes.",
    filter: (event) => (event.cats || []).includes("festival") || (event.cats || []).includes("folklore") || /feast|festival|summer|lito|night|dan mjesta/i.test(`${event.en || ""} ${event.hr || ""}`)
  },
  "things-to-do": {
    title: "Things to Do in Korčula 2026 | Events, Culture and Nightlife",
    h1: "Things to Do in Korčula",
    description: "Things to do in Korčula, from Moreška and festivals to wine nights, family activities, beaches, concerts and nightlife.",
    intro: "Use the events calendar as a practical things-to-do guide: start with culture and family activities by day, then choose concerts, wine nights, village feasts or nightlife in the evening.",
    filter: () => true,
    limit: 90
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

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateInRange(iso, start, end) {
  return iso >= start && iso <= end;
}

function dateRangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function occursOnDate(event, iso) {
  if (event.date > iso || (event.endDate && iso > event.endDate)) return false;
  if (!event.endDate) return event.date === iso;
  if (event.seasonal) return event.date <= iso && iso <= event.endDate;
  if (!event.recurring) return event.date <= iso && iso <= event.endDate;
  const recurrence = String(event.recurring).toLowerCase();
  if (recurrence.includes("daily")) return true;
  const weekdays = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return Object.entries(weekdays).some(([name, value]) => recurrence.includes(name) && day === value);
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

function guideUrl(slug) {
  return `${siteUrl}/guides/${slug}/`;
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

const flyerBase = "/2026 Events/";
const flyers = {
  hkdNapredak: "711533429_10238862739681621_7132440665447619987_n.jpg",
  brunoRacki: "726622978_1324662396311754_1196331273202483318_n.jpg",
  fermata: "729089446_1330560095917082_5424991246713228614_n.jpg",
  malaVelaLukaSah: "733810265_1004139169178619_7406030034854469969_n.jpg",
  sinisaVuco: "739965778_3184088421782240_727211797039421734_n.jpg",
  praviPrijatelj: "741439623_1623547135830221_2514987522212171195_n.jpg",
  ekoKlik: "726427451_1622113932189830_4644658454319049907_n.jfif",
  blatskoLjeto: "728951558_2842843536074422_8664357824117296469_n.jfif",
  kulturnoAvgust1: "729080791_2365533420921531_4732103117572546297_n.jfif",
  kulturnoSrpanj1: "729089537_2052799258997320_7966040970482679038_n.jfif",
  kulturnoAvgust2: "729953708_1801545614355331_6875222987793021677_n.jfif",
  kulturnoSrpanj2: "730584727_2758199641242412_4857147205496412772_n.jfif",
  nogometNaPlazi: "731808257_2355501548310712_7501183823000969035_n.jfif",
  hakunaMatata: "741209865_1350510197149943_3713384124144151341_n.jfif",
  lumbarajskeUzance: "WhatsApp Image 2026-07-08 at 22.58.52.jpeg",
  smokviskoLito: "WhatsApp Image 2026-07-08 at 23.01.19.jpeg",
  litoUPostrani: "WhatsApp Image 2026-07-08 at 23.01.33.jpeg",
  dicoHomo: "WhatsApp Image 2026-07-08 at 23.01.40.jpeg",
  luskoLito: "WhatsApp Image 2026-07-08 at 23.01.50.jpeg",
  litoURaciscu: "lito-u-raciscu.jpeg"
};
const noFlyerIds = new Set(["kt-brodogradnja","kt-kulkviz","kt-moreska-season","kt-svtodor","kt-swordfest","kt-korkyra-baroque","kt-markopolo-gala","kt-winefest"]);

function flyerUrl(name) {
  return flyerBase + encodeURIComponent(name).replace(/%2F/g, "/");
}

function absoluteUrl(url) {
  if (!url) return "";
  const fullUrl = /^https?:\/\//i.test(url) ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  try {
    return encodeURI(decodeURI(fullUrl));
  } catch {
    return encodeURI(fullUrl).replaceAll("%25", "%");
  }
}

function getFlyer(event) {
  const id = event.id;
  if (id.startsWith("kt-fermata")) return flyerUrl(flyers.fermata);
  if (id.startsWith("kt-") && !noFlyerIds.has(id)) {
    const month = event.date.slice(5, 7);
    const day = parseInt(event.date.slice(8, 10), 10);
    if (month === "07") return flyerUrl(day <= 14 ? flyers.kulturnoSrpanj1 : flyers.kulturnoSrpanj2);
    if (month === "08") return flyerUrl(day <= 12 ? flyers.kulturnoAvgust1 : flyers.kulturnoAvgust2);
    return null;
  }
  if (id === "lb-lutke-ekoklik") return flyerUrl(flyers.ekoKlik);
  if (id === "lb-lutke-prijatelj" || id === "lb-lutke-0820") return flyerUrl(flyers.praviPrijatelj);
  if (id === "lb-nogomet") return flyerUrl(flyers.nogometNaPlazi);
  if (id === "lb-hakuna") return flyerUrl(flyers.hakunaMatata);
  if (id.startsWith("lb-")) return flyerUrl(flyers.lumbarajskeUzance);
  if (id === "vl-napredak") return flyerUrl(flyers.hkdNapredak);
  if (id === "vl-racki") return flyerUrl(flyers.brunoRacki);
  if (id === "vl-chess-mala") return flyerUrl(flyers.malaVelaLukaSah);
  if (id.startsWith("vl-")) return flyerUrl(flyers.luskoLito);
  if (id.startsWith("blato-")) return flyerUrl(flyers.blatskoLjeto);
  if (id.startsWith("smk-")) return flyerUrl(flyers.smokviskoLito);
  if (id.startsWith("pst-")) return flyerUrl(flyers.litoUPostrani);
  if (id.startsWith("racisce-")) return flyerUrl(flyers.litoURaciscu);
  if (id === "cara-vuco") return flyerUrl(flyers.sinisaVuco);
  if (id.startsWith("rc-")) return flyerUrl(flyers.dicoHomo);
  return null;
}

function eventTimeRange(event) {
  const startYMD = event.date.replaceAll("-", "");
  const endDate = event.endDate || event.date;
  const explicit = String(event.time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!explicit) {
    const end = new Date(`${endDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { allDay: true, startYMD, endYMD: end.toISOString().slice(0, 10).replaceAll("-", "") };
  }
  const hour = parseInt(explicit[1], 10);
  const minute = parseInt(explicit[2], 10);
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  const start = `${startYMD}T${h}${m}00`;
  const endMinutes = hour * 60 + minute + 120;
  const endDayOffset = Math.floor(endMinutes / 1440);
  const endClockMinutes = endMinutes % 1440;
  const end = new Date(`${event.date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + endDayOffset);
  const endYMD = end.toISOString().slice(0, 10).replaceAll("-", "");
  const endH = String(Math.floor(endClockMinutes / 60)).padStart(2, "0");
  const endM = String(endClockMinutes % 60).padStart(2, "0");
  return { allDay: false, start, end: `${endYMD}T${endH}${endM}00` };
}

function mapsUrl(event, towns) {
  const q = [event.venue, townName(towns, event.town, "en"), "Croatia"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function googleCalendarUrl(event, towns) {
  const range = eventTimeRange(event);
  const dates = range.allDay ? `${range.startYMD}/${range.endYMD}` : `${range.start}/${range.end}`;
  const title = titleFor(event, "en");
  const details = [descFor(event, "en"), event.source || event.website || event.ticketUrl].filter(Boolean).join("\n\n");
  const location = [event.venue, townName(towns, event.town, "en"), "Croatia"].filter(Boolean).join(", ");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${encodeURIComponent(dates)}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(location)}`;
}

function icsDataUrl(event, towns) {
  const range = eventTimeRange(event);
  const title = titleFor(event, "en").replaceAll("\n", " ");
  const description = [descFor(event, "en"), event.source || event.website || event.ticketUrl].filter(Boolean).join("\\n\\n").replaceAll("\n", "\\n");
  const location = [event.venue, townName(towns, event.town, "en"), "Croatia"].filter(Boolean).join(", ").replaceAll("\n", " ");
  const dateLines = range.allDay
    ? `DTSTART;VALUE=DATE:${range.startYMD}\r\nDTEND;VALUE=DATE:${range.endYMD}`
    : `DTSTART:${range.start}\r\nDTEND:${range.end}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Korcula Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@korcula-events.com`,
    dateLines,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}

function languageAlternates(canonical) {
  const languageHomeUrls = new Set(Object.keys(langMeta).map((code) => `${siteUrl}/${code}/`));
  if (!languageHomeUrls.has(canonical)) return "";
  return [
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`,
    ...Object.keys(langMeta).map((code) => `<link rel="alternate" hreflang="${code}" href="${siteUrl}/${code}/">`)
  ].join("\n");
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function itemListSchema(name, url, items) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: typeof item === "string" ? item : item.url,
      name: typeof item === "string" ? undefined : item.name
    }))
  };
}

function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

function sitemapPriority(url) {
  if (url === `${siteUrl}/`) return "1.0";
  if (url === `${siteUrl}/events/` || url === `${siteUrl}/guides/`) return "0.9";
  if (url.includes("/events/")) return "0.8";
  if (url.includes("/guides/") || url.includes("/places/") || url.includes("/categories/")) return "0.7";
  return "0.5";
}

function sitemapChangefreq(url) {
  if (url === `${siteUrl}/` || url === `${siteUrl}/events/`) return "daily";
  if (url.includes("/events/") || url.includes("/guides/")) return "weekly";
  return "monthly";
}

function pageShell({ lang = "en", title, description, canonical, body, schema, image = defaultShareImage, type = "website" }) {
  const alternates = languageAlternates(canonical);
  const schemaHtml = schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : "";
  const imageUrl = absoluteUrl(image) || defaultShareImage;
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
<meta property="og:type" content="${esc(type)}">
<meta property="og:site_name" content="Korčula Island Events">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
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
.seo-card a{color:var(--sea-deeper);font-weight:800;text-decoration:none}
.seo-card a:hover{text-decoration:underline}
.seo-section{background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;margin:18px 0;box-shadow:var(--shadow)}
.seo-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.seo-detail-list{display:grid;gap:8px;margin:0}
.seo-detail-list div{display:grid;grid-template-columns:96px 1fr;gap:8px;border-bottom:1px solid var(--border);padding:8px 0}
.seo-detail-list dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft);font-weight:800}
.seo-detail-list dd{margin:0;color:var(--ink)}
.seo-pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.seo-pill{background:var(--sand);border:1px solid var(--border);border-radius:999px;padding:6px 10px;color:var(--sea-deep);font-weight:800;font-size:.78rem}
.seo-event-layout{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:18px;align-items:start}
.seo-poster{background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px;box-shadow:var(--shadow)}
.seo-poster img{display:block;width:100%;border-radius:8px;object-fit:cover}
.seo-action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.seo-action{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;padding:9px 11px;color:var(--sea-deeper);background:#fff;font:inherit;font-weight:800;text-decoration:none;font-size:.82rem;cursor:pointer}
.seo-action.primary{background:var(--sea-deep);border-color:var(--sea-deep);color:#fff}
.seo-action:hover{text-decoration:underline}
.seo-action[aria-pressed="true"]{background:var(--sand);border-color:var(--sea-deep)}
.seo-form{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;display:grid;gap:12px;margin-top:14px;box-shadow:var(--shadow)}
.seo-form label{display:grid;gap:5px;color:var(--ink);font-size:.86rem;font-weight:800}
.seo-form input,.seo-form textarea{font:inherit;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--sand)}
.seo-form button{justify-self:start;background:var(--sea-deep);color:#fff;border:none;border-radius:8px;padding:11px 15px;font:inherit;font-weight:800;cursor:pointer}
.seo-small{font-size:.82rem}
.seo-footer{max-width:960px;margin:0 auto 24px;padding:0 16px}
@media(max-width:760px){.seo-event-layout{grid-template-columns:1fr}}
@media(max-width:640px){.seo-header-inner{align-items:flex-start;flex-direction:column}.seo-grid,.seo-two-col{grid-template-columns:1fr}.seo-top-nav{gap:9px}.seo-detail-list div{grid-template-columns:1fr}}
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
      <a href="/guides/">Guides</a>
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
        <a href="/guides/">Guides</a>
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
<script>
(() => {
  const favoriteKey = "korcula:favouriteEvents";
  const readFavorites = () => {
    try { return JSON.parse(localStorage.getItem(favoriteKey) || "[]"); } catch { return []; }
  };
  const writeFavorites = (items) => localStorage.setItem(favoriteKey, JSON.stringify(items));
  document.querySelectorAll("[data-favorite-event]").forEach((button) => {
    const id = button.dataset.favoriteEvent;
    const sync = () => {
      const saved = readFavorites().includes(id);
      button.setAttribute("aria-pressed", saved ? "true" : "false");
      button.textContent = saved ? "Saved to favourites" : "Save favourite";
    };
    button.addEventListener("click", () => {
      const items = readFavorites();
      const next = items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
      writeFavorites(next);
      sync();
    });
    sync();
  });
  document.querySelectorAll("[data-copy-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const url = button.dataset.copyUrl || location.href;
      try {
        await navigator.clipboard.writeText(url);
        const previous = button.textContent;
        button.textContent = "Link copied";
        setTimeout(() => { button.textContent = previous; }, 1600);
      } catch {
        location.href = url;
      }
    });
  });
  document.querySelectorAll("[data-share-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      const url = button.dataset.shareUrl || location.href;
      const title = button.dataset.shareTitle || document.title;
      if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch {}
      }
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = "Link copied";
      } catch {
        location.href = url;
      }
    });
  });
})();
</script>
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

function compactEventFacts(event, towns) {
  const facts = [
    ["Date", `${event.date}${event.endDate ? ` to ${event.endDate}` : ""}`],
    ["Time", event.time],
    ["Town", townName(towns, event.town, "en")],
    ["Venue", event.venue],
    ["Recurring", event.recurring],
    ["Seasonal", event.seasonal ? "Yes" : ""],
    ["Source status", event.verify ? "Needs verification before relying on exact details" : "Listed from current calendar data"]
  ].filter(([, value]) => value);
  return `<dl class="seo-detail-list">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}

function eventNarrative(event, towns) {
  const title = titleFor(event, "en");
  const town = townName(towns, event.town, "en");
  const categoryText = (event.cats || []).map((cat) => catLabels[cat] || cat).join(", ");
  const pieces = [
    `${title} is listed in the Korčula Island Events calendar for ${town}${event.venue ? ` at ${event.venue}` : ""}.`,
    event.time ? `The listed time is ${event.time}.` : "",
    event.endDate ? `The event runs from ${event.date} to ${event.endDate}.` : `The listed date is ${event.date}.`,
    categoryText ? `It is currently grouped under ${categoryText}.` : "",
    event.verify ? "Because this listing is marked for verification, use the source links below before making firm plans." : "Use the links below for organiser, ticketing or source details where available."
  ].filter(Boolean);
  return pieces.join(" ");
}

function eventSchema(event, towns) {
  const description = descFor(event, "en") || `${titleFor(event, "en")} in ${townName(towns, event.town, "en")}, Korčula, Croatia.`;
  const flyer = getFlyer(event);
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
  if (flyer) schema.image = [absoluteUrl(flyer)];
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
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "All Korčula Events 2026",
        url: `${siteUrl}/events/`,
        description: "Crawlable index of Korčula island events for summer 2026."
      },
      itemListSchema("All Korčula Events 2026", `${siteUrl}/events/`, events.slice(0, 100).map((event) => ({
        name: titleFor(event, "en"),
        url: eventUrl(event)
      }))),
      breadcrumbSchema([
        { name: "Home", url: `${siteUrl}/` },
        { name: "Events", url: `${siteUrl}/events/` }
      ])
    ]
  }));
  urls.add(`${siteUrl}/events/`);

  await writePage(path.join(dist, "guides", "index.html"), pageShell({
    title: "Korčula Event Guides 2026 | Tonight, This Week, Nightlife and Family",
    description: "Korčula event guides for tonight, this week, nightlife, family activities, summer festivals and things to do.",
    canonical: `${siteUrl}/guides/`,
    body: `
      <section class="seo-hero">
        <p><a href="/">Open interactive calendar</a></p>
        <h1>Korčula Event Guides</h1>
        <p class="seo-lede">Planning-focused guides for common visitor searches: what is on tonight, what is happening this week, where to go with kids, and where to find nightlife or summer festivals.</p>
      </section>
      <div class="seo-grid">
        ${Object.entries(guidePages).map(([slug, guide]) => `<div class="seo-card"><strong>${esc(guide.h1)}</strong><a href="/guides/${esc(slug)}/">Open guide</a></div>`).join("")}
      </div>
    `,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Korčula Event Guides 2026",
        url: `${siteUrl}/guides/`
      },
      itemListSchema("Korčula Event Guides 2026", `${siteUrl}/guides/`, Object.entries(guidePages).map(([slug, guide]) => ({
        name: guide.h1,
        url: guideUrl(slug)
      }))),
      breadcrumbSchema([
        { name: "Home", url: `${siteUrl}/` },
        { name: "Guides", url: `${siteUrl}/guides/` }
      ])
    ]
  }));
  urls.add(`${siteUrl}/guides/`);

  const guideContext = { today: buildDate, weekEnd: addDays(buildDate, 7) };
  for (const [slug, guide] of Object.entries(guidePages)) {
    const guideEvents = events.filter((event) => guide.filter(event, guideContext)).slice(0, guide.limit || events.length);
    const url = guideUrl(slug);
    urls.add(url);
    await writePage(path.join(dist, "guides", slug, "index.html"), pageShell({
      title: guide.title,
      description: guide.description,
      canonical: url,
      body: `
        <section class="seo-hero">
          <p><a href="/guides/">All guides</a> · <a href="/">Interactive calendar</a></p>
          <h1>${esc(guide.h1)}</h1>
          <p class="seo-lede">${esc(guide.intro)}</p>
          <div class="seo-grid">
            <div class="seo-card"><strong>${guideEvents.length} matching listings</strong><span>Generated from the current event database.</span></div>
            <div class="seo-card"><strong>Last updated</strong><span>${esc(buildDate)}</span></div>
            <div class="seo-card"><strong>Planning tip</strong><span>Check event source links before committing to tickets or travel.</span></div>
          </div>
        </section>
        ${guideEvents.length ? eventList(guideEvents, towns, "en") : "<p>No matching events are currently listed. Check the main calendar for more options.</p>"}
      `,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: guide.h1,
          url,
          description: guide.description
        },
        itemListSchema(guide.h1, url, guideEvents.slice(0, 60).map((event) => ({
          name: titleFor(event, "en"),
          url: eventUrl(event)
        }))),
        breadcrumbSchema([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Guides", url: `${siteUrl}/guides/` },
          { name: guide.h1, url }
        ]),
        faqSchema([
          {
            question: `How current is ${guide.h1}?`,
            answer: `This guide is generated from the current Korčula Events database and was last rebuilt on ${buildDate}. Always check event source links before booking or travelling.`
          },
          {
            question: "Does Korčula Events include smaller villages and local programmes?",
            answer: "Yes. The calendar includes Korčula Town, Lumbarda, Vela Luka, Blato, Smokvica, Račišće, Žrnovo, Postrana, Čara, Pupnat, Kneže, Zavalatica and nearby Orebić or Pelješac events where relevant."
          }
        ])
      ]
    }));
  }

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
    const relatedByTown = events.filter((item) => item.id !== event.id && item.town === event.town).slice(0, 6);
    const relatedByCategory = events.filter((item) => item.id !== event.id && (item.cats || []).some((cat) => (event.cats || []).includes(cat))).slice(0, 6);
    const flyer = getFlyer(event);
    const mapHref = mapsUrl(event, towns);
    const gcalHref = googleCalendarUrl(event, towns);
    const icsHref = icsDataUrl(event, towns);
    const shareText = `${title} | Korčula Events 2026`;
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;
    const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    const pills = [
      ...((event.cats || []).map((cat) => `<a class="seo-pill" href="${esc(categoryUrl(cat))}">${esc(catLabels[cat] || cat)}</a>`)),
      `<a class="seo-pill" href="${esc(placeUrl(event.town))}">${esc(town)}</a>`
    ].join("");
    await writePage(eventPath(event), pageShell({
      title: `${title} | Korčula Events 2026`,
      description: description.slice(0, 155),
      canonical: url,
      image: flyer || defaultShareImage,
      type: "article",
      body: `
        <section class="seo-hero">
          <p><a href="/events/">All events</a> · <a href="/">Interactive calendar</a></p>
          <div class="seo-event-layout">
            <div>
              <h1>${esc(title)}</h1>
              <p class="seo-lede">${esc(description)}</p>
              <div class="seo-grid">
                <div class="seo-card"><strong>Date</strong><span>${esc(event.date)}${event.endDate ? ` to ${esc(event.endDate)}` : ""}${event.time ? ` · ${esc(event.time)}` : ""}</span></div>
                <div class="seo-card"><strong>Place</strong><span>${esc(town)}${event.venue ? ` · ${esc(event.venue)}` : ""}</span></div>
                <div class="seo-card"><strong>Category</strong><span>${esc((event.cats || []).map((cat) => catLabels[cat] || cat).join(", "))}</span></div>
              </div>
              <div class="seo-action-row">
                <a class="seo-action primary" href="${esc(gcalHref)}" target="_blank" rel="noopener">Android / Google Calendar</a>
                <a class="seo-action" href="${esc(icsHref)}" download="${esc(event.id)}.ics">iPhone / Apple Calendar (.ics)</a>
                <a class="seo-action" href="${esc(mapHref)}" target="_blank" rel="noopener">Open in Google Maps</a>
                <button class="seo-action" type="button" data-favorite-event="${esc(event.id)}" aria-pressed="false">Save favourite</button>
                <button class="seo-action" type="button" data-share-event data-share-url="${esc(url)}" data-share-title="${esc(shareText)}">Share</button>
                <a class="seo-action" href="${esc(whatsappHref)}" target="_blank" rel="noopener">WhatsApp</a>
                <a class="seo-action" href="${esc(facebookHref)}" target="_blank" rel="noopener">Facebook</a>
                <button class="seo-action" type="button" data-copy-url="${esc(url)}">Copy link / Instagram</button>
              </div>
            </div>
            ${flyer ? `<aside class="seo-poster"><a href="${esc(flyer)}"><img src="${esc(flyer)}" alt="${esc(title)} event poster"></a></aside>` : ""}
          </div>
          <div class="seo-pill-row">${pills}</div>
        </section>
        <section class="seo-section seo-two-col">
          <div>
            <h2>Event details</h2>
            ${compactEventFacts(event, towns)}
          </div>
          <div>
            <h2>What to know</h2>
            <p>${esc(eventNarrative(event, towns))}</p>
            ${event.hr && event.hr !== title ? `<p><strong>Local title:</strong> ${esc(event.hr)}</p>` : ""}
            ${event.desc && event.desc.hr ? `<p><strong>Croatian note:</strong> ${esc(stripHtml(event.desc.hr))}</p>` : ""}
          </div>
        </section>
        ${event.verify ? "<p>Details are marked for verification. Check the linked source before relying on the exact time.</p>" : ""}
        ${sourceLinks.length ? `<section class="seo-section"><h2>Source and booking links</h2><ul>${sourceLinks.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul></section>` : ""}
        ${relatedByTown.length ? `<section class="seo-section"><h2>More events in ${esc(town)}</h2>${eventList(relatedByTown, towns, "en", 6)}</section>` : ""}
        ${relatedByCategory.length ? `<section class="seo-section"><h2>Similar events</h2>${eventList(relatedByCategory, towns, "en", 6)}</section>` : ""}
      `,
      schema: [
        eventSchema(event, towns),
        breadcrumbSchema([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Events", url: `${siteUrl}/events/` },
          { name: title, url }
        ])
      ]
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
    `,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Korčula Events by Place",
        url: `${siteUrl}/places/`
      },
      itemListSchema("Korčula Events by Place", `${siteUrl}/places/`, towns
        .filter((town) => events.some((event) => event.town === town.id))
        .map((town) => ({
          name: town.en || town.hr,
          url: placeUrl(town.id)
        }))),
      breadcrumbSchema([
        { name: "Home", url: `${siteUrl}/` },
        { name: "Places", url: `${siteUrl}/places/` }
      ])
    ]
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
      `,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${town.en || town.hr} Events 2026`,
          url,
          description: `Events in ${town.en || town.hr}, Korčula island, in 2026.`
        },
        itemListSchema(`${town.en || town.hr} Events 2026`, url, townEvents.slice(0, 60).map((event) => ({
          name: titleFor(event, "en"),
          url: eventUrl(event)
        }))),
        breadcrumbSchema([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Places", url: `${siteUrl}/places/` },
          { name: town.en || town.hr, url }
        ])
      ]
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
    `,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Korčula Events by Category",
        url: `${siteUrl}/categories/`
      },
      itemListSchema("Korčula Events by Category", `${siteUrl}/categories/`, Object.keys(catLabels)
        .filter((cat) => events.some((event) => (event.cats || []).includes(cat)))
        .map((cat) => ({
          name: catLabels[cat],
          url: categoryUrl(cat)
        }))),
      breadcrumbSchema([
        { name: "Home", url: `${siteUrl}/` },
        { name: "Categories", url: `${siteUrl}/categories/` }
      ])
    ]
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
      `,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Korčula ${catLabels[cat]} Events 2026`,
          url,
          description: `${catLabels[cat]} events on Korčula island in 2026.`
        },
        itemListSchema(`Korčula ${catLabels[cat]} Events 2026`, url, catEvents.slice(0, 60).map((event) => ({
          name: titleFor(event, "en"),
          url: eventUrl(event)
        }))),
        breadcrumbSchema([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Categories", url: `${siteUrl}/categories/` },
          { name: catLabels[cat], url }
        ])
      ]
    }));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls).sort().map((url) => `  <url>
    <loc>${esc(url)}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${sitemapChangefreq(url)}</changefreq>
    <priority>${sitemapPriority(url)}</priority>
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
