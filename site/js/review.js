(function () {
  const state = {
    pending: { meta: {}, candidates: [] },
    events: { events: [] },
    sourceReport: { counts: {}, rows: [] },
    socialReport: { counts: {}, rows: [] },
    posterReport: { counts: {}, results: [] },
    panel: "candidates",
    ref: new URLSearchParams(window.location.search).get("ref") || ""
  };

  const $ = (sel) => document.querySelector(sel);

  function dataUrl(path) {
    if (!state.ref) return path;
    const params = new URLSearchParams({ ref: state.ref });
    return `https://api.github.com/repos/oliver-trako/korcula-events/contents/site/${path}?${params.toString()}`;
  }

  async function loadJson(path, fallback) {
    try {
      const headers = state.ref ? { Accept: "application/vnd.github.raw" } : {};
      const res = await fetch(dataUrl(path), { cache: "no-store", headers });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return await res.json();
    } catch (err) {
      console.warn("Could not load", path, err);
      return fallback;
    }
  }

  function downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function short(value, len) {
    const text = String(value || "");
    return text.length > len ? text.slice(0, len - 1) + "…" : text;
  }

  function statusCounts() {
    const candidates = state.pending.candidates || [];
    $("#statPending").textContent = candidates.filter((c) => c.status === "needs-review" || c.status === "new").length;
    $("#statStructured").textContent = candidates.filter((c) => c.event).length;
    $("#statSocial").textContent = (state.socialReport.rows || []).length;
    $("#statErrors").textContent = ((state.sourceReport.rows || []).filter((r) => r.status === "error")).length;
  }

  function eventTitle(candidate) {
    if (candidate.event) return candidate.event.en || candidate.event.hr || candidate.event.id;
    return candidate.sourceName || candidate.id;
  }

  function eventSubtitle(candidate) {
    if (!candidate.event) return candidate.sourceUrl || "";
    const e = candidate.event;
    return [e.date, e.endDate ? "to " + e.endDate : "", e.time, e.town, e.venue].filter(Boolean).join(" · ");
  }

  function candidateCard(candidate, index) {
    const reasons = (candidate.reviewReasons || []).map((r) => `<span class="review-pill warn">${escapeHtml(r)}</span>`).join("");
    const duplicateRisk = candidate.duplicateRisk === "high" ? '<span class="review-pill warn">possible duplicate</span>' : "";
    const duplicateMatches = (candidate.duplicateMatches || []).map((match) => {
      return `<li><strong>${escapeHtml(match.eventId)}</strong> (${escapeHtml(match.score)}) ${escapeHtml(match.title || "")} ${escapeHtml([match.date, match.time, match.venue].filter(Boolean).join(" · "))}</li>`;
    }).join("");
    const evidence = candidate.evidence || {};
    const eventJson = candidate.event ? JSON.stringify(candidate.event, null, 2) : "";
    const snippet = evidence.textSnippet || candidate.notes || "";
    const statusClass = candidate.status === "merged" || candidate.status === "approved" ? "ok" : "warn";

    return `<article class="review-card" data-index="${index}">
      <div>
        <h2>${escapeHtml(eventTitle(candidate))}</h2>
        <div class="review-meta">
          <span class="review-pill ${statusClass}">${escapeHtml(candidate.status || "new")}</span>
          <span class="review-pill">${escapeHtml(candidate.sourceName || "Unknown source")}</span>
          ${candidate.event ? '<span class="review-pill ok">structured</span>' : '<span class="review-pill warn">evidence only</span>'}
          ${duplicateRisk}
          ${reasons}
        </div>
        <p class="review-subtitle">${escapeHtml(eventSubtitle(candidate))}</p>
        ${duplicateMatches ? `<div class="review-snippet"><strong>Possible existing matches:</strong><ul>${duplicateMatches}</ul></div>` : ""}
        <p class="review-snippet">${escapeHtml(snippet)}</p>
        ${candidate.sourceUrl ? `<p class="review-snippet"><a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener">Open source</a></p>` : ""}
      </div>
      <div class="review-editor">
        <textarea aria-label="Event JSON">${escapeHtml(eventJson)}</textarea>
        <div class="review-button-row">
          <button type="button" class="approve">Approve into events</button>
          <button type="button" class="needs">Needs review</button>
          <button type="button" class="reject">Reject</button>
          <button type="button" class="duplicate">Duplicate</button>
        </div>
      </div>
    </article>`;
  }

  function renderCandidates() {
    const panel = $("#panel-candidates");
    const candidates = state.pending.candidates || [];
    const actionable = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter((item) => item.candidate.status === "new" || item.candidate.status === "needs-review");
    const handled = candidates.length - actionable.length;
    if (!actionable.length) {
      panel.innerHTML = '<div class="review-card empty-review">No pending candidates in this file.</div>';
      return;
    }
    const note = handled > 0 ? `<div class="review-card empty-review">${handled} auto-handled candidates are hidden from this approval list.</div>` : "";
    panel.innerHTML = note + actionable.map((item) => candidateCard(item.candidate, item.index)).join("");
  }

  function renderSocial() {
    const panel = $("#panel-social");
    const rows = state.socialReport.rows || [];
    if (!rows.length) {
      panel.innerHTML = '<div class="social-row empty-review">No social sources in the current report yet. Run the ingestion workflow to refresh this list.</div>';
      return;
    }
    panel.innerHTML = rows.map((row) => `<article class="social-row">
      <div>
        <h2>${escapeHtml(row.sourceName)}</h2>
        <p>${escapeHtml([row.platform, row.kind, row.town, row.priority, row.confidence].filter(Boolean).join(" · "))}</p>
        <p>${escapeHtml(row.action || "")}</p>
        <div class="social-keywords">${escapeHtml((row.keywords || []).join(", "))}</div>
      </div>
      <a class="review-home open-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener">Open</a>
    </article>`).join("");
  }

  function renderPosters() {
    const panel = $("#panel-posters");
    const rows = state.posterReport.results || [];
    if (!rows.length) {
      panel.innerHTML = '<div class="source-row empty-review">No poster OCR report yet. Add posters to 2026 Events and run ingestion.</div>';
      return;
    }
    panel.innerHTML = rows.map((row) => {
      const imageHref = row.imagePath ? row.imagePath.replace(/^2026 Events\//, "../2026%20Events/") : "";
      const hints = [
        (row.dateHints || []).length ? "dates: " + row.dateHints.join(", ") : "",
        (row.timeHints || []).length ? "times: " + row.timeHints.join(", ") : ""
      ].filter(Boolean).join(" · ");
      return `<article class="source-row">
        <div>
          <h2>${escapeHtml(row.imagePath || "Poster")}</h2>
          <p>${escapeHtml([row.status, hints].filter(Boolean).join(" · "))}</p>
          <p>${escapeHtml(short(row.textSnippet || row.note || row.error || "", 400))}</p>
        </div>
        ${imageHref ? `<a class="review-home open-link" href="${escapeHtml(imageHref)}" target="_blank" rel="noopener">Open poster</a>` : ""}
      </article>`;
    }).join("");
  }

  function renderSources() {
    const panel = $("#panel-sources");
    const rows = state.sourceReport.rows || [];
    if (!rows.length) {
      panel.innerHTML = '<div class="source-row empty-review">No source-check report yet. Run the ingestion workflow to refresh this file.</div>';
      return;
    }
    panel.innerHTML = rows.map((row) => {
      const isError = row.status === "error";
      return `<article class="source-row">
        <div>
          <h2>${escapeHtml(row.sourceName)}</h2>
          <p>${escapeHtml([row.status, row.kind, row.scrapeMode].filter(Boolean).join(" · "))}</p>
          <p>${escapeHtml(isError ? row.error : short((row.keywordHits || []).join(", "), 180))}</p>
        </div>
        <a class="review-home open-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener">Open</a>
      </article>`;
    }).join("");
  }

  function render() {
    renderRefNotice();
    statusCounts();
    renderCandidates();
    renderPosters();
    renderSocial();
    renderSources();
  }

  function renderRefNotice() {
    let notice = $(".review-ref-notice");
    if (!notice) {
      notice = document.createElement("section");
      notice.className = "review-ref-notice";
      document.querySelector(".review-shell").prepend(notice);
    }
    if (state.ref) {
      notice.innerHTML = `<strong>Reviewing branch data:</strong> ${escapeHtml(state.ref)} <a href="review.html">Switch to live data</a>`;
      notice.hidden = false;
    } else {
      notice.innerHTML = "<strong>Reviewing live data.</strong> Open the ingestion PR review link to inspect branch candidates before merge.";
      notice.hidden = false;
    }
  }

  function setPanel(panelName) {
    state.panel = panelName;
    document.querySelectorAll(".review-tabs button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === panelName);
    });
    ["candidates", "posters", "social", "sources"].forEach((name) => {
      $("#panel-" + name).hidden = name !== panelName;
    });
  }

  function updateCandidateFromCard(card, status) {
    const index = Number(card.dataset.index);
    const candidate = state.pending.candidates[index];
    const text = card.querySelector("textarea").value.trim();
    if (text) {
      try {
        candidate.event = JSON.parse(text);
      } catch (err) {
        alert("Event JSON is invalid: " + err.message);
        return;
      }
    }

    if (status === "approved") {
      if (!candidate.event || !candidate.event.id) {
        alert("Approved candidates need an event object with an id.");
        return;
      }
      const exists = (state.events.events || []).some((event) => event.id === candidate.event.id);
      if (!exists) state.events.events.push(candidate.event);
      state.events.events.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.time || "").localeCompare(String(b.time || "")) || String(a.id || "").localeCompare(String(b.id || "")));
      candidate.status = "merged";
      candidate.reviewMode = "manual-approved";
      candidate.reviewedAt = new Date().toISOString();
      candidate.mergedAt = new Date().toISOString();
    } else {
      candidate.status = status;
      candidate.reviewMode = "manual-review";
      candidate.reviewedAt = new Date().toISOString();
    }
    render();
  }

  function bindEvents() {
    $(".review-tabs").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-panel]");
      if (btn) setPanel(btn.dataset.panel);
    });

    $("#panel-candidates").addEventListener("click", (ev) => {
      const card = ev.target.closest(".review-card[data-index]");
      if (!card) return;
      if (ev.target.matches(".approve")) updateCandidateFromCard(card, "approved");
      if (ev.target.matches(".needs")) updateCandidateFromCard(card, "needs-review");
      if (ev.target.matches(".reject")) updateCandidateFromCard(card, "rejected");
      if (ev.target.matches(".duplicate")) updateCandidateFromCard(card, "duplicate");
    });

    $("#downloadPending").addEventListener("click", () => downloadJson("pending-events.json", state.pending));
    $("#downloadEvents").addEventListener("click", () => downloadJson("events.json", state.events));

    $("#pendingUpload").addEventListener("change", async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      state.pending = JSON.parse(await file.text());
      render();
    });

    $("#eventsUpload").addEventListener("change", async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      state.events = JSON.parse(await file.text());
      render();
    });
  }

  async function init() {
    const [pending, events, sourceReport, socialReport, posterReport] = await Promise.all([
      loadJson("data/pending-events.json", state.pending),
      loadJson("data/events.json", state.events),
      loadJson("data/source-check-report.json", state.sourceReport),
      loadJson("data/social-source-report.json", state.socialReport),
      loadJson("data/poster-ocr-report.json", state.posterReport)
    ]);
    state.pending = pending;
    state.events = events;
    state.sourceReport = sourceReport;
    state.socialReport = socialReport;
    state.posterReport = posterReport;
    bindEvents();
    render();
    setPanel("candidates");
  }

  init();
})();
