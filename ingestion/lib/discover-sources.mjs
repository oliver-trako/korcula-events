/**
 * Phase 4: periodic discovery of new event/venue/organizer pages for Korčula island that
 * aren't yet tracked in sources.json. Never auto-adds anything -- returns candidates for a
 * human to approve via a GitHub Issue (see run-discover-sources.mjs).
 *
 * `searchImpl(query) -> Promise<{title, url, snippet}[]>` is injected rather than hardcoded to
 * one search provider, matching the DI pattern used throughout this codebase (retrieval.mjs's
 * fetchImpl, ai-client.mjs's fetchImpl). The default implementation below calls Google's Custom
 * Search JSON API, which needs `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` -- new
 * credentials, separate from the Cloudflare Workers AI ones used for extraction/verification.
 * Free tier: 100 queries/day, comfortably enough for one monthly run of a handful of queries.
 */

export async function googleSearch(query, { apiKey, searchEngineId, fetchImpl = fetch } = {}) {
  if (!apiKey || !searchEngineId) throw new Error("googleSearch requires apiKey and searchEngineId (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID)");
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(searchEngineId)}&num=10&q=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`google-search-http-error:${response.status}`);
  const body = await response.json();
  return (body.items || []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
}

const DEFAULT_QUERIES = [
  "Korčula događanja 2026",
  "Lumbarda events 2026",
  "Vela Luka koncerti 2026",
  "Blato manifestacije 2026",
  "Orebić events Pelješac 2026",
  "Žrnovo Pupnat Račišće događanja"
];

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

/**
 * @param {object} existingSources - parsed ingestion/data/sources.json.
 * @param {object} options - { searchImpl, queries }
 * @returns {Promise<object[]>} candidates not already covered by an existing source's urls.
 */
export async function discoverNewSources(existingSources, { searchImpl, queries = DEFAULT_QUERIES } = {}) {
  if (typeof searchImpl !== "function") throw new Error("discoverNewSources requires a searchImpl function");

  const knownHosts = new Set();
  for (const source of existingSources.sources) {
    for (const u of source.urls || []) {
      const host = hostnameOf(u.url);
      if (host) knownHosts.add(host);
    }
  }

  const seenHosts = new Set();
  const candidates = [];

  for (const query of queries) {
    const results = await searchImpl(query);
    for (const result of results) {
      const host = hostnameOf(result.url);
      if (!host || knownHosts.has(host) || seenHosts.has(host)) continue;
      seenHosts.add(host);
      candidates.push({
        id: `discovered-${host.replace(/\./g, "-")}`,
        name: result.title,
        url: result.url,
        type: "guide-site",
        notes: result.snippet
      });
    }
  }
  return candidates;
}
