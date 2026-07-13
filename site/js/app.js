(function () {
  "use strict";

  const SUPPORTED_LANGS = ["hr", "en", "de", "it", "sl", "fr"];

  function preferredLang() {
    const stored = localStorage.getItem("kk_lang");
    if (SUPPORTED_LANGS.includes(stored)) return stored;
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const lang of langs) {
      const base = String(lang).toLowerCase().split("-")[0];
      if (SUPPORTED_LANGS.includes(base)) return base;
    }
    return "hr";
  }

  function initialQuery() {
    return new URLSearchParams(window.location.search).get("q") || "";
  }

  const state = {
    lang: preferredLang(),
    view: "calendar",
    cats: new Set(),
    towns: new Set(),
    query: initialQuery(),
    calMonth: null, // Date, first of month
    calSelectedDate: null,
    events: [],
    towns_meta: [],
    ferry: null,
    activeEventId: null
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const setText = (sel, text) => {
    const node = $(sel);
    if (node) node.textContent = text;
  };
  const setValue = (sel, value) => {
    const node = $(sel);
    if (node) node.value = value;
  };
  const setPlaceholder = (sel, text) => {
    const node = $(sel);
    if (node) node.placeholder = text;
  };

  function t() { return I18N[state.lang]; }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(aISO, bISO) {
    const a = parseISO(aISO), b = parseISO(bISO);
    return Math.round((b - a) / 86400000);
  }

  function fmtDate(iso, opts) {
    const d = parseISO(iso);
    const T = t();
    const day = d.getDate();
    const mon = T.months[d.getMonth()];
    if (opts && opts.short) return day + " " + mon.slice(0, 3);
    return day + ". " + mon;
  }

  // ---------- Load data ----------
  fetch("data/events.json")
    .then((r) => r.json())
    .then((data) => {
      state.events = data.events.slice().sort(compareEvents);
      state.towns_meta = data.meta.towns;
      state.ferry = (data.practicalInfo || {}).ferry_korcula_orebic || null;
      state.calMonth = (() => { const d = parseISO(todayISO()); return new Date(d.getFullYear(), d.getMonth(), 1); })();
      state.calSelectedDate = todayISO();
      init();
    })
    .catch((err) => {
      $("#main").innerHTML = '<p style="padding:20px;color:#a33">Failed to load events data: ' + err + "</p>";
    });

  function init() {
    applyLang();
    buildFilterChips();
    bindEvents();
    render();
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
  }

  // ---------- Language ----------
  function applyLang() {
    const T = t();
    document.documentElement.lang = state.lang;
    setValue("#langSelect", state.lang);
    document.title = T.siteTitle;
    setText("#siteTitle", T.siteTitle);
    setText("#tagline", T.tagline);
    setText("#heroKicker", T.heroKicker);
    setText("#heroText", T.heroText);
    setPlaceholder("#searchInput", T.searchPlaceholder);
    setValue("#searchInput", state.query);
    setText("#navToday", T.navToday);
    setText("#navAgenda", T.navAgenda);
    setText("#navCalendar", T.navCalendar);
    setText("#navSeason", T.navSeason);
    setText("#navMap", T.navMap);
    setText("#filterCategory", T.filterCategory);
    setText("#filterLocation", T.filterLocation);
    setText("#filterCategoryLabel", T.filterCategory);
    setText("#filterLocationLabel", T.filterLocation);
    setText("#filterClearLabel", T.filterClear);
    setText("#footerNote", T.footerNote);
    setText("#footerBuilt", T.footerBuilt);
    setText("#suggestFabLabel", T.suggestFab);
    setText("#suggestTitle", T.suggestTitle);
    setText("#suggestIntro", T.suggestIntro);
    setText("#lblEventName", T.lblEventName);
    setText("#lblEventDate", T.lblEventDate);
    setText("#lblEventTime", T.lblEventTime);
    setText("#lblEventVenue", T.lblEventVenue);
    setText("#lblEventDesc", T.lblEventDesc);
    setText("#lblSubmitterContact", T.lblSubmitterContact);
    setText("#lblAttachFlyer", T.attachFlyer);
    setText("#suggestSubmitBtn", T.suggestSubmit);
    buildFilterChips();
  }

  // ---------- Filter chips ----------
  function categoryCounts() {
    const counts = {};
    state.events.forEach((e) => e.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    return counts;
  }
  function townCounts() {
    const counts = {};
    state.events.forEach((e) => (counts[e.town] = (counts[e.town] || 0) + 1));
    return counts;
  }

  function buildFilterChips() {
    const T = t();
    const catCounts = categoryCounts();
    const catOrder = ["music","nightlife","folklore","food","theatre","kids","film","sports","religious","exhibition","literature","festival","market"];
    const catWrap = $("#categoryChips");
    catWrap.innerHTML = "";
    catOrder.filter((c) => catCounts[c]).forEach((c) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.cats.has(c) ? " selected" : "");
      chip.setAttribute("aria-pressed", state.cats.has(c));
      chip.innerHTML = (T.catLabels[c] || c) + ' <span class="cnt">' + catCounts[c] + "</span>";
      chip.onclick = () => { toggleSetVal(state.cats, c); render(); };
      catWrap.appendChild(chip);
    });

    const tCounts = townCounts();
    const locWrap = $("#locationChips");
    locWrap.innerHTML = "";
    state.towns_meta.forEach((town) => {
      if (!tCounts[town.id]) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.towns.has(town.id) ? " selected" : "");
      chip.setAttribute("aria-pressed", state.towns.has(town.id));
      chip.innerHTML = (town[state.lang] || town.en) + ' <span class="cnt">' + tCounts[town.id] + "</span>";
      chip.onclick = () => { toggleSetVal(state.towns, town.id); render(); };
      locWrap.appendChild(chip);
    });

    updateFilterBadge();
  }

  function toggleSetVal(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

  function updateFilterBadge() {
    const n = state.cats.size + state.towns.size;
    const badge = $("#filterBadge");
    const clearBtn = $("#filterClear");
    if (n > 0) { badge.hidden = false; badge.textContent = n; clearBtn.hidden = false; }
    else { badge.hidden = true; clearBtn.hidden = true; }
  }

  // ---------- Filtering ----------
  function matchesFilters(e) {
    if (state.cats.size && !e.cats.some((c) => state.cats.has(c))) return false;
    if (state.towns.size && !state.towns.has(e.town)) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = (e.hr + " " + e.en + " " + (e.venue||"") + " " + townName(e.town)).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  // ---------- Flyer lookup ----------
  // Points at the original poster photos (kept in the "2026 Events" folder, one level above /site/).
  const FLYER_BASE = "../2026 Events/";
  const FLYERS = {
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
  const NO_FLYER_IDS = new Set(["kt-brodogradnja","kt-kulkviz","kt-moreska-season","kt-svtodor","kt-swordfest","kt-korkyra-baroque","kt-markopolo-gala","kt-winefest"]);

  function flyerUrl(name) { return FLYER_BASE + encodeURIComponent(name).replace(/%2F/g, "/"); }

  function getFlyer(e) {
    const id = e.id;
    if (id.startsWith("kt-fermata")) return flyerUrl(FLYERS.fermata);
    if (id.startsWith("kt-") && !NO_FLYER_IDS.has(id)) {
      const month = e.date.slice(5, 7), day = parseInt(e.date.slice(8, 10), 10);
      if (month === "07") return flyerUrl(day <= 14 ? FLYERS.kulturnoSrpanj1 : FLYERS.kulturnoSrpanj2);
      if (month === "08") return flyerUrl(day <= 12 ? FLYERS.kulturnoAvgust1 : FLYERS.kulturnoAvgust2);
      return null;
    }
    if (id === "lb-lutke-ekoklik") return flyerUrl(FLYERS.ekoKlik);
    if (id === "lb-lutke-prijatelj" || id === "lb-lutke-0820") return flyerUrl(FLYERS.praviPrijatelj);
    if (id === "lb-nogomet") return flyerUrl(FLYERS.nogometNaPlazi);
    if (id === "lb-hakuna") return flyerUrl(FLYERS.hakunaMatata);
    if (id.startsWith("lb-")) return flyerUrl(FLYERS.lumbarajskeUzance);
    if (id === "vl-napredak") return flyerUrl(FLYERS.hkdNapredak);
    if (id === "vl-racki") return flyerUrl(FLYERS.brunoRacki);
    if (id === "vl-chess-mala") return flyerUrl(FLYERS.malaVelaLukaSah);
    if (id.startsWith("vl-")) return flyerUrl(FLYERS.luskoLito);
    if (id.startsWith("blato-")) return flyerUrl(FLYERS.blatskoLjeto);
    if (id.startsWith("smk-")) return flyerUrl(FLYERS.smokviskoLito);
    if (id.startsWith("pst-")) return flyerUrl(FLYERS.litoUPostrani);
    if (id.startsWith("racisce-")) return flyerUrl(FLYERS.litoURaciscu);
    if (id === "cara-vuco") return flyerUrl(FLYERS.sinisaVuco);
    if (id.startsWith("rc-")) return flyerUrl(FLYERS.dicoHomo);
    return null;
  }

  let lastFocusedEl = null;

  function openFlyer(url, ev) {
    if (ev) ev.stopPropagation();
    lastFocusedEl = document.activeElement;
    $("#flyerImg").src = url;
    $("#flyerModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#flyerClose").focus();
  }
  function closeFlyer() {
    $("#flyerModal").hidden = true;
    $("#flyerImg").src = "";
    document.body.style.overflow = "";
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  function townName(id) {
    const tw = state.towns_meta.find((x) => x.id === id);
    return tw ? (tw[state.lang] || tw.en) : id;
  }

  function isOngoing(e, iso) {
    if (e.seasonal) return false; // seasonal/recurring-window events are shown in their own strip, not per-day
    if (e.date > iso || (e.endDate && iso > e.endDate)) return false;
    if (e.recurring) {
      const recurrence = String(e.recurring).toLowerCase();
      if (recurrence.includes("daily")) return true;
      const weekdays = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };
      for (const [name, day] of Object.entries(weekdays)) {
        if (recurrence.includes(name)) return parseISO(iso).getDay() === day;
      }
      return true;
    }
    if (!e.endDate) return e.date === iso;
    return e.date <= iso && iso <= e.endDate;
  }

  function isLiveSeasonal(e, iso) {
    return e.seasonal && e.date <= iso && (!e.endDate || iso <= e.endDate);
  }

  function eventStartMinutes(e) {
    const time = String(e.time || "").toLowerCase();
    const m = time.match(/(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if (time.includes("morning")) return 9 * 60;
    if (time.includes("afternoon")) return 14 * 60;
    if (time.includes("evening")) return 19 * 60;
    if (time.includes("midnight")) return 24 * 60;
    if (time.includes("varies")) return 23 * 60 + 59;
    return 24 * 60 + 1;
  }

  function timeBadgeLabel(e) {
    const time = String(e.time || "");
    const lower = time.toLowerCase();
    const labels = {
      morning: { hr:"Jutro", en:"Morning", de:"Morgen", it:"Mattina", sl:"Jutro", fr:"Matin" },
      afternoon: { hr:"Popodne", en:"Afternoon", de:"Nachmittag", it:"Pomeriggio", sl:"Popoldne", fr:"Après-midi" },
      evening: { hr:"Večer", en:"Evening", de:"Abend", it:"Sera", sl:"Večer", fr:"Soir" },
      late: { hr:"Kasno", en:"Late", de:"Spät", it:"Tardi", sl:"Pozno", fr:"Tard" },
      varies: { hr:"Razno", en:"Varies", de:"Variiert", it:"Varia", sl:"Različno", fr:"Variable" },
      tbc: { hr:"TBC", en:"TBC", de:"TBC", it:"TBC", sl:"TBC", fr:"TBC" }
    };
    const pick = (key) => labels[key][state.lang] || labels[key].en;
    if (!time) return "•";
    if (/^\d/.test(time)) return time;
    if (lower.includes("after midnight") || lower.includes("midnight")) return pick("late");
    if (lower.includes("morning")) return pick("morning");
    if (lower.includes("afternoon")) return pick("afternoon");
    if (lower.includes("evening")) return pick("evening");
    if (lower.includes("varies")) return pick("varies");
    if (lower.includes("tbc")) return pick("tbc");
    return time.length <= 10 ? time : "•";
  }

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

  function translateEventText(text, lang) {
    if (!text || lang === "en" || lang === "hr" || !eventTranslationRules[lang]) return text || "";
    let out = text;
    eventTranslationRules[lang].forEach(([from, to]) => {
      out = out.split(from).join(to);
    });
    return out;
  }

  function eventTitle(e) {
    if (state.lang === "hr") return e.hr || e.en || "";
    if (e[state.lang]) return e[state.lang];
    return translateEventText(e.en || e.hr || "", state.lang);
  }

  function compareEvents(a, b) {
    return String(a.date || "").localeCompare(String(b.date || "")) ||
      eventStartMinutes(a) - eventStartMinutes(b) ||
      String(a.id || "").localeCompare(String(b.id || ""));
  }

  function compareEventsForDay(a, b) {
    const aExact = /^\d{1,2}:\d{2}/.test(String(a.time || ""));
    const bExact = /^\d{1,2}:\d{2}/.test(String(b.time || ""));
    if (aExact !== bExact) return aExact ? -1 : 1;
    return eventStartMinutes(a) - eventStartMinutes(b) ||
      eventTitle(a).localeCompare(eventTitle(b)) ||
      String(a.id || "").localeCompare(String(b.id || ""));
  }

  function sortEvents(list) {
    return list.slice().sort(compareEvents);
  }

  function sortDayEvents(list) {
    return list.slice().sort(compareEventsForDay);
  }

  function isFerryRelevant(e) {
    return e.town === "orebic" || e.town === "peljesac";
  }

  // ---------- Rendering dispatcher ----------
  function render() {
    buildFilterChips();
    ["today", "agenda", "calendar", "season", "map"].forEach((v) => {
      $("#view-" + v).hidden = state.view !== v;
    });
    $$(".view-tab").forEach((btn) => {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active);
    });

    if (state.view === "today") renderToday();
    else if (state.view === "agenda") renderAgenda();
    else if (state.view === "calendar") renderCalendar();
    else if (state.view === "season") renderSeason();
    else if (state.view === "map") renderPlaces();

    renderResultsMeta();
  }

  function renderResultsMeta() {
    const T = t();
    const filtered = state.events.filter(matchesFilters);
    const root = $("#resultsMeta");
    root.innerHTML = "";
    const countEl = document.createElement("div");
    countEl.textContent = filtered.length + " " + T.resultsCount;
    root.appendChild(countEl);

    if (state.towns.has("orebic")) {
      const banner = document.createElement("div");
      banner.className = "orebic-banner";
      banner.textContent = T.fromOrebicBanner;
      root.appendChild(banner);
    }
  }

  // ---------- Today view ----------
  function renderToday() {
    const T = t();
    const iso = todayISO();
    const filtered = state.events.filter(matchesFilters);
    const todayList = sortDayEvents(filtered.filter((e) => isOngoing(e, iso)));
    const tomorrowISO = (() => { const d = parseISO(iso); d.setDate(d.getDate() + 1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();
    const tomorrowList = sortDayEvents(filtered.filter((e) => isOngoing(e, tomorrowISO)));
    const weekList = sortEvents(filtered.filter((e) => {
      const db = daysBetween(iso, e.date);
      return db > 1 && db <= 7;
    }));
    const laterList = sortEvents(filtered.filter((e) => daysBetween(iso, e.date) > 7)).slice(0, 40);

    const root = $("#view-today");
    root.innerHTML = "";

    if (!todayList.length && !tomorrowList.length && !weekList.length) {
      root.appendChild(elNote(T.noEventsFiltered));
    }

    if (todayList.length) root.appendChild(dateGroup(T.todayHeading, todayList, true));
    if (tomorrowList.length) root.appendChild(dateGroup(T.tomorrowHeading, tomorrowList, false));
    if (weekList.length) root.appendChild(dateGroup(T.thisWeekHeading, weekList, false, true));
    if (laterList.length) root.appendChild(dateGroup(T.laterHeading, laterList, false, true));
  }

  function renderSeason() {
    const T = t();
    const list = sortEvents(state.events.filter(matchesFilters).filter((e) => e.seasonal));
    const root = $("#view-season");
    root.innerHTML = "";
    if (!list.length) { root.appendChild(elNote(T.noEventsFiltered)); return; }
    root.appendChild(seasonalStrip(list));
  }

  function seasonalStrip(list) {
    const wrap = document.createElement("div");
    wrap.className = "date-group seasonal-strip";
    const h = document.createElement("h2");
    h.textContent = ({ hr:"U tijeku ove sezone", en:"Running this season", de:"Diese Saison im Gange", it:"In corso questa stagione", sl:"Poteka to sezono", fr:"En cours cette saison" }[state.lang]);
    wrap.appendChild(h);
    list.forEach((e) => wrap.appendChild(eventCard(e, false, true)));
    return wrap;
  }

  // Makes a non-button element (card/cell/row) behave like one for keyboard & screen-reader users.
  function makeAccessibleClickable(el, handler, label) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    if (label) el.setAttribute("aria-label", label);
    el.addEventListener("click", handler);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); handler(ev); }
    });
  }

  function elNote(text) {
    const p = document.createElement("p");
    p.style.cssText = "padding:24px 4px;color:var(--ink-soft);font-size:.9rem;";
    p.textContent = text;
    return p;
  }

  function dateGroup(heading, list, isToday, showDate) {
    const wrap = document.createElement("div");
    wrap.className = "date-group";
    const h = document.createElement("h2");
    h.innerHTML = heading + (isToday ? ' <span class="pill-today">' + t().navToday + "</span>" : "");
    wrap.appendChild(h);
    list.forEach((e) => wrap.appendChild(eventCard(e, showDate)));
    return wrap;
  }

  // ---------- Agenda view (full chronological, grouped by date) ----------
  function renderAgenda() {
    const T = t();
    const filtered = sortEvents(state.events.filter(matchesFilters));
    const root = $("#view-agenda");
    root.innerHTML = "";
    if (!filtered.length) { root.appendChild(elNote(T.noEventsFiltered)); return; }

    let currentDate = null, groupEl = null;
    filtered.forEach((e) => {
      if (e.date !== currentDate) {
        currentDate = e.date;
        groupEl = document.createElement("div");
        groupEl.className = "date-group";
        const h = document.createElement("h2");
        const iso = todayISO();
        h.innerHTML = fmtDate(e.date) + (e.date === iso ? ' <span class="pill-today">' + T.navToday + "</span>" : "");
        groupEl.appendChild(h);
        root.appendChild(groupEl);
      }
      groupEl.appendChild(eventCard(e, false));
    });
  }

  // ---------- Event card ----------
  function eventCard(e, showDate, seasonalMode) {
    const T = t();
    const card = document.createElement("div");
    card.className = "event-card";
    if (e.town === "orebic") card.classList.add("nearby-event");
    const d = parseISO(e.date);

    const badge = document.createElement("div");
    badge.className = "event-time-badge";
    if (seasonalMode) {
      badge.innerHTML = '<span class="time" style="display:block;font-size:.68rem;">' + fmtDate(e.date, {short:true}) + (e.endDate ? " – " + fmtDate(e.endDate, {short:true}) : "") + "</span>";
      badge.style.flexBasis = "72px";
    } else if (showDate) {
      badge.innerHTML = '<span class="day">' + d.getDate() + '</span><span class="mon">' + T.months[d.getMonth()].slice(0,3) + "</span>" + (e.time ? '<span class="time">' + timeBadgeLabel(e) + "</span>" : "");
    } else {
      badge.innerHTML = timeBadgeLabel(e);
      badge.style.fontSize = "1rem";
    }

    const body = document.createElement("div");
    body.className = "event-body";
    const title = document.createElement("p");
    title.className = "event-title";
    title.textContent = eventTitle(e);
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.innerHTML = '<span class="town-tag">' + townName(e.town) + "</span>" + (e.venue ? "<span>" + e.venue + "</span>" : "");
    body.appendChild(meta);

    const cats = document.createElement("div");
    cats.className = "event-cats";
    e.cats.forEach((c) => {
      const pill = document.createElement("span");
      pill.className = "cat-pill";
      pill.textContent = T.catLabels[c] || c;
      cats.appendChild(pill);
    });
    if (e.town === "orebic") {
      const np = document.createElement("span");
      np.className = "cat-pill badge-nearby";
      np.textContent = T.nearbyFerry;
      cats.appendChild(np);
    }
    if (/besplatan|slobodan|free/i.test(e.hr + e.en)) {
      const fp = document.createElement("span");
      fp.className = "cat-pill badge-free";
      fp.textContent = T.free;
      cats.appendChild(fp);
    }
    if (e.verify) {
      const vp = document.createElement("span");
      vp.className = "cat-pill badge-verify";
      vp.textContent = "⚠ " + T.verifyBadge;
      cats.appendChild(vp);
    }
    body.appendChild(cats);

    card.appendChild(badge);
    card.appendChild(body);

    const flyer = getFlyer(e);
    if (flyer) {
      const thumb = document.createElement("img");
      thumb.className = "event-flyer-thumb";
      thumb.src = flyer;
      thumb.alt = "";
      thumb.loading = "lazy";
      makeAccessibleClickable(thumb, (ev) => openFlyer(flyer, ev), T.viewFlyer);
      card.appendChild(thumb);
    }

    const cardLabel = eventTitle(e);
    makeAccessibleClickable(card, () => openModal(e), cardLabel);
    return card;
  }

  // ---------- Calendar view ----------
  function renderCalendar() {
    const T = t();
    const root = $("#calGrid");
    root.innerHTML = "";
    const month = state.calMonth;
    $("#calMonthLabel").textContent = T.months[month.getMonth()] + " " + month.getFullYear();

    T.daysShort.forEach((d) => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = d;
      root.appendChild(el);
    });

    const firstDow = month.getDay(); // 0=Sun
    for (let i = 0; i < firstDow; i++) {
      const el = document.createElement("div");
      el.className = "cal-cell empty";
      root.appendChild(el);
    }

    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const iso = todayISO();
    const filtered = state.events.filter(matchesFilters).filter((e) => !e.seasonal);

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(month.getFullYear(), month.getMonth(), day);
      const cellISO = cellDate.getFullYear() + "-" + String(cellDate.getMonth()+1).padStart(2,"0") + "-" + String(day).padStart(2,"0");
      const dayEvents = sortDayEvents(filtered.filter((e) => isOngoing(e, cellISO)));

      const cell = document.createElement("div");
      cell.className = "cal-cell" + (cellISO === iso ? " today" : "") + (cellISO === state.calSelectedDate ? " selected" : "");
      cell.innerHTML = '<span class="dnum">' + day + "</span>";
      if (dayEvents.length) {
        const dots = document.createElement("div");
        dots.className = "cal-dots";
        dayEvents.slice(0, 4).forEach(() => {
          const dot = document.createElement("span");
          dot.className = "cal-dot";
          dots.appendChild(dot);
        });
        cell.appendChild(dots);
      }
      makeAccessibleClickable(cell, () => { state.calSelectedDate = cellISO; renderCalendar(); }, fmtDate(cellISO) + (dayEvents.length ? " — " + dayEvents.length + " " + T.resultsCount : ""));
      root.appendChild(cell);
    }

    const dayWrap = $("#calDayEvents");
    dayWrap.innerHTML = "";
    const hasActiveSearchOrFilter = Boolean(state.query || state.cats.size || state.towns.size);
    if (state.calSelectedDate) {
      const dayEvents = sortDayEvents(filtered.filter((e) => isOngoing(e, state.calSelectedDate)));
      const h = document.createElement("h2");
      h.style.cssText = "font-size:.95rem;color:var(--sea-deep);margin:0 0 10px;";
      h.textContent = fmtDate(state.calSelectedDate);
      dayWrap.appendChild(h);
      if (!dayEvents.length) dayWrap.appendChild(elNote(T.noEventsFiltered));
      dayEvents.forEach((e) => dayWrap.appendChild(eventCard(e, false)));
    } else if (hasActiveSearchOrFilter) {
      const h = document.createElement("h2");
      h.style.cssText = "font-size:.95rem;color:var(--sea-deep);margin:0 0 10px;";
      h.textContent = T.matchingEvents;
      dayWrap.appendChild(h);
      if (!filtered.length) dayWrap.appendChild(elNote(T.noEventsFiltered));
      sortEvents(filtered).slice(0, 30).forEach((e) => dayWrap.appendChild(eventCard(e, true)));
    }
  }

  // ---------- Places view ----------
  function renderPlaces() {
    const T = t();
    const counts = townCounts();
    const root = $("#placeList");
    root.innerHTML = "";
    state.towns_meta.filter((tw) => counts[tw.id]).forEach((tw) => {
      const row = document.createElement("div");
      row.className = "place-row";
      if (tw.id === "orebic") row.classList.add("nearby-place");
      row.innerHTML = "<span>" + (tw[state.lang] || tw.en) + '</span><span class="cnt">' + counts[tw.id] + " " + T.resultsCount + "</span>";
      makeAccessibleClickable(row, () => {
        state.towns.clear();
        state.towns.add(tw.id);
        state.view = "agenda";
        render();
      }, (tw[state.lang] || tw.en) + ", " + counts[tw.id] + " " + T.resultsCount);
      root.appendChild(row);
    });
  }

  // ---------- Calendar export & maps ----------
  function parseStartTime(timeStr) {
    const m = timeStr && timeStr.match(/^(\d{1,2}):(\d{2})/);
    return m ? { h: parseInt(m[1], 10), min: parseInt(m[2], 10) } : null;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  // Returns {allDay, startYMD, startHM, endYMD, endHM} in local/floating time (no timezone conversion —
  // fine here since every event happens in Croatia and viewers are assumed to be there too).
  function eventTimeRange(e) {
    const time = parseStartTime(e.time);
    const startDate = e.date.replace(/-/g, "");
    if (!time) {
      const d = parseISO(e.endDate || e.date);
      d.setDate(d.getDate() + 1); // ICS/Google all-day DTEND is exclusive
      const endDate = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
      return { allDay: true, startYMD: startDate, endYMD: endDate };
    }
    const startHM = pad2(time.h) + pad2(time.min) + "00";
    let endH = time.h + 2;
    const endHM = pad2(endH % 24) + pad2(time.min) + "00";
    const endDate = (e.endDate || e.date).replace(/-/g, "");
    return { allDay: false, startYMD: startDate, startHM, endYMD: endDate, endHM };
  }

  function googleCalUrl(e) {
    const r = eventTimeRange(e);
    const dates = r.allDay ? r.startYMD + "/" + r.endYMD : r.startYMD + "T" + r.startHM + "/" + r.endYMD + "T" + r.endHM;
    const title = eventTitle(e);
    const details = ((e.desc && (e.desc[state.lang] || e.desc.en)) || "") + (e.source ? "\n\n" + e.source : "");
    const location = (e.venue ? e.venue + ", " : "") + townName(e.town) + ", Croatia";
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(title) +
      "&dates=" + dates +
      "&details=" + encodeURIComponent(details) +
      "&location=" + encodeURIComponent(location);
  }

  function icsDataUrl(e) {
    const r = eventTimeRange(e);
    const title = eventTitle(e);
    const desc = ((e.desc && (e.desc[state.lang] || e.desc.en)) || "").replace(/\n/g, "\\n");
    const location = (e.venue ? e.venue + ", " : "") + townName(e.town) + ", Croatia";
    const dtLines = r.allDay
      ? "DTSTART;VALUE=DATE:" + r.startYMD + "\nDTEND;VALUE=DATE:" + r.endYMD
      : "DTSTART:" + r.startYMD + "T" + r.startHM + "\nDTEND:" + r.endYMD + "T" + r.endHM;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Korcula Events//EN", "BEGIN:VEVENT",
      "UID:" + e.id + "@korcula-events.com", dtLines,
      "SUMMARY:" + title.replace(/\n/g, " "), "DESCRIPTION:" + desc, "LOCATION:" + location,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    return "data:text/calendar;charset=utf8," + encodeURIComponent(ics);
  }

  function mapsUrl(e) {
    const q = (e.venue ? e.venue + ", " : "") + townName(e.town) + ", Croatia";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event";
  }

  function eventDetailUrl(e) {
    return location.origin + "/events/" + slugify(e.en || e.hr || e.id) + "-" + slugify(e.id) + "/";
  }

  function readSavedEvents() {
    try { return JSON.parse(localStorage.getItem("korcula:favouriteEvents") || "[]"); }
    catch (err) { return []; }
  }

  function writeSavedEvents(items) {
    localStorage.setItem("korcula:favouriteEvents", JSON.stringify(items));
  }

  function syncFavoriteButton(button, id) {
    const saved = readSavedEvents().includes(id);
    button.setAttribute("aria-pressed", saved ? "true" : "false");
    button.textContent = saved ? (t().savedFavourite || "Saved") : (t().saveFavourite || "Save favourite");
  }

  function toggleFavorite(e, button) {
    const items = readSavedEvents();
    const next = items.includes(e.id) ? items.filter((id) => id !== e.id) : items.concat(e.id);
    writeSavedEvents(next);
    syncFavoriteButton(button, e.id);
  }

  async function copyEventLink(url, button) {
    try {
      await navigator.clipboard.writeText(url);
      const original = button.textContent;
      button.textContent = t().linkCopied;
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch (err) {
      location.href = url;
    }
  }

  async function shareEvent(e, button) {
    const url = eventDetailUrl(e);
    const title = eventTitle(e) + " | Korčula Events";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // Fall back to copying below when the share sheet is cancelled or unavailable.
      }
    }
    await copyEventLink(url, button);
  }

  function eventLinks(e) {
    const T = t();
    const defs = [
      ["ticketUrl", T.ticketLabel],
      ["website", T.websiteLabel],
      ["facebook", "Facebook"],
      ["instagram", "Instagram"],
      ["source", T.sourceLabel]
    ];
    const seen = new Set();
    return defs
      .filter(([key]) => e[key])
      .filter(([key]) => {
        const href = e[key];
        if (seen.has(href)) return false;
        seen.add(href);
        return true;
      })
      .map(([key, label]) => ({ href: e[key], label }));
  }

  // ---------- Modal ----------
  function openModal(e) {
    const T = t();
    const modal = $("#eventModal");
    const body = $("#modalBody");
    state.activeEventId = e.id;
    const primaryTitle = eventTitle(e);
    let html = "<div class='modal-body'>";
    html += "<h2>" + primaryTitle + "</h2>";
    html += "<div class='modal-row'><strong>" + T.dateLabel + "</strong> " + fmtDate(e.date) + (e.endDate ? " – " + fmtDate(e.endDate) : "") + (e.time ? " · " + e.time : "") + "</div>";
    html += "<div class='modal-row'><strong>" + T.placeLabel + "</strong> <a class='maps-link' href='" + mapsUrl(e) + "' target='_blank' rel='noopener'>" + townName(e.town) + (e.venue ? ", " + e.venue : "") + " ↗</a></div>";
    html += "<div class='event-cats'>" + e.cats.map((c) => "<span class='cat-pill'>" + (T.catLabels[c]||c) + "</span>").join("") + "</div>";
    if (e.desc) {
      const d = e.desc[state.lang] || translateEventText(e.desc.en || e.desc.hr || "", state.lang);
      if (d) html += "<p class='modal-desc'>" + d + "</p>";
    }
    if (e.verify) html += "<div class='verify-note'>⚠ " + T.verifyNote + "</div>";
    if (isFerryRelevant(e) && state.ferry) {
      const ferryText = state.ferry[state.lang] || state.ferry.en || "";
      const ferrySource = state.ferry.source || "https://www.jadrolinija.hr/";
      html += "<div class='ferry-info event-ferry-info'><strong>" + T.ferryInfoTitle + "</strong><p>" + ferryText + "</p><a href='" + ferrySource + "' target='_blank' rel='noopener'>" + (T.ferryScheduleLink || T.sourceLabel) + " ↗</a></div>";
    }
    html += "</div>";
    body.innerHTML = html;

    const links = eventLinks(e);
    if (links.length) {
      const linkRow = document.createElement("div");
      linkRow.className = "modal-link-row";
      links.forEach((link) => {
        const a = document.createElement("a");
        a.className = "modal-resource-link";
        a.href = link.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = link.label + " ↗";
        linkRow.appendChild(a);
      });
      body.querySelector(".modal-body").appendChild(linkRow);
    }

    const flyer = getFlyer(e);
    if (flyer) {
      const flyerBtn = document.createElement("button");
      flyerBtn.className = "modal-flyer-btn";
      flyerBtn.textContent = T.viewFlyer;
      flyerBtn.onclick = () => openFlyer(flyer);
      body.querySelector(".modal-body").appendChild(flyerBtn);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "modal-action-row";
    const saveTitle = document.createElement("h3");
    saveTitle.className = "modal-action-title";
    saveTitle.textContent = T.saveEvent;
    body.querySelector(".modal-body").appendChild(saveTitle);

    if (!e.seasonal) {
      const gcalBtn = document.createElement("a");
      gcalBtn.className = "modal-action-btn";
      gcalBtn.href = googleCalUrl(e);
      gcalBtn.target = "_blank"; gcalBtn.rel = "noopener";
      gcalBtn.textContent = T.googleCalendar || T.addToCalendar;

      const icsBtn = document.createElement("a");
      icsBtn.className = "modal-action-btn primary-save";
      icsBtn.href = icsDataUrl(e);
      icsBtn.download = e.id + ".ics";
      icsBtn.textContent = T.downloadIcs;
      actionRow.appendChild(icsBtn);
      actionRow.appendChild(gcalBtn);
    } else {
      const unavailable = document.createElement("p");
      unavailable.className = "calendar-unavailable-note";
      unavailable.textContent = T.saveEventUnavailable;
      body.querySelector(".modal-body").appendChild(unavailable);
    }

    const copyBtn = document.createElement("button");
    copyBtn.className = "modal-action-btn";
    copyBtn.type = "button";
    copyBtn.textContent = T.copyLink;
    copyBtn.onclick = () => copyEventLink(eventDetailUrl(e), copyBtn);
    actionRow.appendChild(copyBtn);

    const favBtn = document.createElement("button");
    favBtn.className = "modal-action-btn";
    favBtn.type = "button";
    favBtn.onclick = () => toggleFavorite(e, favBtn);
    syncFavoriteButton(favBtn, e.id);
    actionRow.appendChild(favBtn);

    const shareBtn = document.createElement("button");
    shareBtn.className = "modal-action-btn";
    shareBtn.type = "button";
    shareBtn.textContent = T.shareEvent || "Share";
    shareBtn.onclick = () => shareEvent(e, shareBtn);
    actionRow.appendChild(shareBtn);

    const whatsAppBtn = document.createElement("a");
    whatsAppBtn.className = "modal-action-btn";
    whatsAppBtn.href = "https://wa.me/?text=" + encodeURIComponent(eventTitle(e) + " | Korčula Events " + eventDetailUrl(e));
    whatsAppBtn.target = "_blank";
    whatsAppBtn.rel = "noopener";
    whatsAppBtn.textContent = "WhatsApp";
    actionRow.appendChild(whatsAppBtn);

    const facebookBtn = document.createElement("a");
    facebookBtn.className = "modal-action-btn";
    facebookBtn.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(eventDetailUrl(e));
    facebookBtn.target = "_blank";
    facebookBtn.rel = "noopener";
    facebookBtn.textContent = "Facebook";
    actionRow.appendChild(facebookBtn);

    const instagramBtn = document.createElement("button");
    instagramBtn.className = "modal-action-btn";
    instagramBtn.type = "button";
    instagramBtn.textContent = T.copyForInstagram || "Copy link / Instagram";
    instagramBtn.onclick = () => copyEventLink(eventDetailUrl(e), instagramBtn);
    actionRow.appendChild(instagramBtn);

    body.querySelector(".modal-body").appendChild(actionRow);

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    lastFocusedEl = document.activeElement;
    $("#modalClose").focus();
    history.replaceState(null, "", "#event=" + e.id);
  }

  function closeModal() {
    $("#eventModal").hidden = true;
    state.activeEventId = null;
    document.body.style.overflow = "";
    if (lastFocusedEl) lastFocusedEl.focus();
    history.replaceState(null, "", location.pathname + location.search);
  }

  function openFromHash() {
    const m = location.hash.match(/^#event=(.+)$/);
    if (!m) return;
    const e = state.events.find((x) => x.id === decodeURIComponent(m[1]));
    if (e) openModal(e);
  }

  // ---------- Event bindings ----------
  function bindEvents() {
    $("#langSelect").addEventListener("change", (e) => {
      state.lang = e.target.value;
      localStorage.setItem("kk_lang", state.lang);
      applyLang();
      render();
      if (!$("#eventModal").hidden && state.activeEventId) {
        const active = state.events.find((x) => x.id === state.activeEventId);
        if (active) openModal(active);
      }
    });

    $$(".view-tab").forEach((btn) => {
      btn.addEventListener("click", () => { state.view = btn.dataset.view; render(); });
    });

    $("#searchInput").addEventListener("input", (e) => { state.query = e.target.value.trim(); render(); });

    $("#filterToggle").addEventListener("click", () => {
      const panel = $("#filterPanel");
      panel.hidden = !panel.hidden;
      $("#filterToggle").setAttribute("aria-expanded", !panel.hidden);
    });

    $("#filterClear").addEventListener("click", () => {
      state.cats.clear();
      state.towns.clear();
      render();
    });

    $("#calPrev").addEventListener("click", () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      const today = parseISO(todayISO());
      state.calSelectedDate = today.getFullYear() === state.calMonth.getFullYear() && today.getMonth() === state.calMonth.getMonth() ? todayISO() : null;
      renderCalendar();
    });
    $("#calNext").addEventListener("click", () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      const today = parseISO(todayISO());
      state.calSelectedDate = today.getFullYear() === state.calMonth.getFullYear() && today.getMonth() === state.calMonth.getMonth() ? todayISO() : null;
      renderCalendar();
    });

    $("#modalClose").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", closeModal);
    $("#flyerClose").addEventListener("click", closeFlyer);
    $("#flyerBackdrop").addEventListener("click", closeFlyer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeSuggest(); closeFlyer(); } });

    $("#suggestFab").addEventListener("click", openSuggest);
    $("#suggestClose").addEventListener("click", closeSuggest);
    $("#suggestBackdrop").addEventListener("click", closeSuggest);
    $("#suggestForm").addEventListener("submit", onSuggestSubmit);

    if (localStorage.getItem("kk_cookie_ok") !== "1") {
      const notice = $("#cookieNotice");
      if (notice) notice.hidden = false;
    }
    const cookieAccept = $("#cookieAccept");
    if (cookieAccept) {
      cookieAccept.addEventListener("click", () => {
        localStorage.setItem("kk_cookie_ok", "1");
        const notice = $("#cookieNotice");
        if (notice) notice.hidden = true;
      });
    }
  }

  // ---------- Suggest an event ----------
  const SUGGEST_EMAIL = "events@korcula-events.com";

  function openSuggest() {
    lastFocusedEl = document.activeElement;
    $("#suggestModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#suggestClose").focus();
  }
  function closeSuggest() {
    if (lastFocusedEl) lastFocusedEl.focus();
    $("#suggestModal").hidden = true;
    document.body.style.overflow = "";
  }

  async function onSuggestSubmit(ev) {
    ev.preventDefault();
    const T = t();
    const fd = new FormData(ev.target);
    const name = fd.get("eventName") || "";
    const date = fd.get("eventDate") || "";
    const time = fd.get("eventTime") || "";
    const venue = fd.get("eventVenue") || "";
    const desc = fd.get("eventDesc") || "";
    const contact = fd.get("submitterContact") || "";
    const flyerFile = fd.get("flyerFile");
    const hasFlyer = flyerFile && flyerFile.size > 0;

    const subject = "Korčula events — suggestion: " + name;
    const bodyLines = [
      "Event name: " + name,
      "Date: " + date + (time ? " " + time : ""),
      "Venue: " + venue,
      "Description: " + desc,
      "Submitted by (email): " + (contact || "—"),
      hasFlyer ? "Flyer photo: attached (" + flyerFile.name + ")" : "Flyer photo: none",
      "",
      "(Sent from the Korčula Island Events \"Suggest an event\" form)"
    ];
    const bodyText = bodyLines.join("\n");

    // On devices that support native sharing with files (most mobile browsers), share
    // the flyer photo directly to the user's mail/messaging app of choice, pre-attached.
    if (hasFlyer && navigator.canShare && navigator.canShare({ files: [flyerFile] })) {
      try {
        await navigator.share({ title: subject, text: bodyText + "\n\nPlease send to: " + SUGGEST_EMAIL, files: [flyerFile] });
        ev.target.reset();
        closeSuggest();
        return;
      } catch (err) {
        // user cancelled the share sheet, or share failed — fall through to mailto below
      }
    }

    if (hasFlyer) {
      const note = $("#flyerFallbackNote");
      note.textContent = "⚠ " + T.flyerFallbackNote;
      note.hidden = false;
    }

    const mailto = "mailto:" + SUGGEST_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyText);
    window.location.href = mailto;
    ev.target.reset();
    setTimeout(closeSuggest, hasFlyer ? 2500 : 0);
  }
})();
