(function () {
  const state = {
    pending: { meta: {}, candidates: [] },
    events: { events: [] },
    sourceReport: { counts: {}, rows: [] },
    socialReport: { counts: {}, rows: [] },
    panel: "candidates"
  };

  const $ = (sel) => document.querySelector(sel);

  async function loadJson(url, fallback) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return await res.json();
    } catch (err) {
      console.warn("Could not load", url, err);
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
          ${reasons}
        </div>
        <p class="review-subtitle">${escapeHtml(eventSubtitle(candidate))}</p>
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
    if (!candidates.length) {
      panel.innerHTML = '<div class="review-card empty-review">No pending candidates in this file.</div>';
      return;
    }
    panel.innerHTML = candidates.map(candidateCard).join("");
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
    statusCounts();
    renderCandidates();
    renderSocial();
    renderSources();
  }

  function setPanel(panelName) {
    state.panel = panelName;
    document.querySelectorAll(".review-tabs button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === panelName);
    });
    ["candidates", "social", "sources"].forEach((name) => {
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
    const [pending, events, sourceReport, socialReport] = await Promise.all([
      loadJson("data/pending-events.json", state.pending),
      loadJson("data/events.json", state.events),
      loadJson("data/source-check-report.json", state.sourceReport),
      loadJson("data/social-source-report.json", state.socialReport)
    ]);
    state.pending = pending;
    state.events = events;
    state.sourceReport = sourceReport;
    state.socialReport = socialReport;
    bindEvents();
    render();
    setPanel("candidates");
  }

  init();
})();
