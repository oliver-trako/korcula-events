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
    ferry: null
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

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
      state.events = data.events.slice().sort((a, b) => (a.date + (a.time||"")).localeCompare(b.date + (b.time||"")));
      state.towns_meta = data.meta.towns;
      state.ferry = (data.practicalInfo || {}).ferry_korcula_orebic || null;
      state.calMonth = (() => { const d = parseISO(todayISO()); return new Date(d.getFullYear(), d.getMonth(), 1); })();
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
    $("#langSelect").value = state.lang;
    document.title = T.siteTitle;
    $("#siteTitle").textContent = T.siteTitle;
    $("#tagline").textContent = T.tagline;
    $("#heroKicker").textContent = T.heroKicker;
    $("#heroText").textContent = T.heroText;
    $("#searchInput").placeholder = T.searchPlaceholder;
    $("#searchInput").value = state.query;
    $("#navToday").textContent = T.navToday;
    $("#navAgenda").textContent = T.navAgenda;
    $("#navCalendar").textContent = T.navCalendar;
    $("#navSeason").textContent = T.navSeason;
    $("#navMap").textContent = T.navMap;
    $("#filterCategory").textContent = T.filterCategory;
    $("#filterLocation").textContent = T.filterLocation;
    $("#filterCategoryLabel").textContent = T.filterCategory;
    $("#filterLocationLabel").textContent = T.filterLocation;
    $("#filterClearLabel").textContent = T.filterClear;
    $("#ferryInfoTitle").textContent = T.ferryInfoTitle;
    $("#ferryInfoText").textContent = state.ferry ? state.ferry[state.lang] || state.ferry.en : "";
    $("#footerNote").textContent = T.footerNote;
    $("#footerBuilt").textContent = T.footerBuilt;
    $("#suggestFabLabel").textContent = T.suggestFab;
    $("#suggestTitle").textContent = T.suggestTitle;
    $("#suggestIntro").textContent = T.suggestIntro;
    $("#lblEventName").textContent = T.lblEventName;
    $("#lblEventDate").textContent = T.lblEventDate;
    $("#lblEventTime").textContent = T.lblEventTime;
    $("#lblEventVenue").textContent = T.lblEventVenue;
    $("#lblEventDesc").textContent = T.lblEventDesc;
    $("#lblSubmitterContact").textContent = T.lblSubmitterContact;
    $("#lblAttachFlyer").textContent = T.attachFlyer;
    $("#suggestSubmitBtn").textContent = T.suggestSubmit;
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
    if (!e.endDate) return e.date === iso;
    return e.date <= iso && iso <= e.endDate;
  }

  function isLiveSeasonal(e, iso) {
    return e.seasonal && e.date <= iso && (!e.endDate || iso <= e.endDate);
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
    const todayList = filtered.filter((e) => isOngoing(e, iso));
    const tomorrowISO = (() => { const d = parseISO(iso); d.setDate(d.getDate() + 1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();
    const tomorrowList = filtered.filter((e) => isOngoing(e, tomorrowISO));
    const weekList = filtered.filter((e) => {
      const db = daysBetween(iso, e.date);
      return db > 1 && db <= 7;
    });
    const laterList = filtered.filter((e) => daysBetween(iso, e.date) > 7).slice(0, 40);

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
    const list = state.events.filter(matchesFilters).filter((e) => e.seasonal).sort((a, b) => a.date.localeCompare(b.date));
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
    const filtered = state.events.filter(matchesFilters).slice().sort((a,b)=> (a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
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
      badge.innerHTML = '<span class="day">' + d.getDate() + '</span><span class="mon">' + T.months[d.getMonth()].slice(0,3) + "</span>" + (e.time && e.time.match(/^\d/) ? '<span class="time">' + e.time + "</span>" : "");
    } else {
      badge.innerHTML = (e.time && e.time.match(/^\d/) ? e.time : "•");
      badge.style.fontSize = "1rem";
    }

    const body = document.createElement("div");
    body.className = "event-body";
    const title = document.createElement("p");
    title.className = "event-title";
    title.textContent = state.lang === "hr" ? e.hr : e.en;
    body.appendChild(title);
    if (state.lang !== "hr" && e.en !== e.hr) {
      const sub = document.createElement("p");
      sub.className = "event-title-en";
      sub.textContent = e.hr;
      body.appendChild(sub);
    } else if (state.lang === "hr" && e.en !== e.hr) {
      const sub = document.createElement("p");
      sub.className = "event-title-en";
      sub.textContent = e.en;
      body.appendChild(sub);
    }

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

    const cardLabel = state.lang === "hr" ? e.hr : e.en;
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
      const dayEvents = filtered.filter((e) => isOngoing(e, cellISO));

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
      const dayEvents = filtered.filter((e) => isOngoing(e, state.calSelectedDate));
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
      filtered.slice(0, 30).forEach((e) => dayWrap.appendChild(eventCard(e, true)));
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
    const title = state.lang === "hr" ? e.hr : e.en;
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
    const title = state.lang === "hr" ? e.hr : e.en;
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
    const primaryTitle = state.lang === "hr" ? e.hr : e.en;
    const secondaryTitle = state.lang === "hr" ? e.en : e.hr;
    let html = "<div class='modal-body'>";
    html += "<h2>" + primaryTitle + "</h2>";
    if (secondaryTitle !== primaryTitle) html += "<p class='modal-en'>" + secondaryTitle + "</p>";
    html += "<div class='modal-row'><strong>" + T.dateLabel + "</strong> " + fmtDate(e.date) + (e.endDate ? " – " + fmtDate(e.endDate) : "") + (e.time ? " · " + e.time : "") + "</div>";
    html += "<div class='modal-row'><strong>" + T.placeLabel + "</strong> <a class='maps-link' href='" + mapsUrl(e) + "' target='_blank' rel='noopener'>" + townName(e.town) + (e.venue ? ", " + e.venue : "") + " ↗</a></div>";
    html += "<div class='event-cats'>" + e.cats.map((c) => "<span class='cat-pill'>" + (T.catLabels[c]||c) + "</span>").join("") + "</div>";
    if (e.desc) {
      const d = e.desc[state.lang] || e.desc.en || e.desc.hr;
      if (d) html += "<p class='modal-desc'>" + d + "</p>";
    }
    if (e.verify) html += "<div class='verify-note'>⚠ " + T.verifyNote + "</div>";
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
    copyBtn.onclick = () => {
      const url = location.origin + location.pathname + "#event=" + e.id;
      navigator.clipboard && navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = T.linkCopied;
        setTimeout(() => { copyBtn.textContent = T.copyLink; }, 1800);
      });
    };
    actionRow.appendChild(copyBtn);
    body.querySelector(".modal-body").appendChild(actionRow);

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    lastFocusedEl = document.activeElement;
    $("#modalClose").focus();
    history.replaceState(null, "", "#event=" + e.id);
  }

  function closeModal() {
    $("#eventModal").hidden = true;
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
      state.calSelectedDate = null;
      renderCalendar();
    });
    $("#calNext").addEventListener("click", () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      state.calSelectedDate = null;
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
  }

  // ---------- Suggest an event ----------
  const SUGGEST_EMAIL = "oliver.trako@whiteleopard.com.au";

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
