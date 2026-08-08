/**
 * Phase 4: periodic discovery of new event/venue/organizer pages for Korčula island that
 * aren't yet tracked in sources.json. Never auto-adds anything -- returns candidates for a
 * human to approve via a GitHub Issue (see run-discover-sources.mjs).
 *
 * `searchImpl(query) -> Promise<{title, url, snippet}[]>` is injected rather than hardcoded to
 * one search provider, matching the DI pattern used throughout this codebase (retrieval.mjs's
 * fetchImpl, ai-client.mjs's fetchImpl). The default implementation below calls Bing's Web
 * Search API, which needs `BING_SEARCH_API_KEY` -- a new credential, separate from the
 * Cloudflare Workers AI one used for extraction/verification. Chosen over Google Custom Search
 * because Google restricted new engines to a fixed 50-domain allowlist as of 2026-01-20 --
 * exactly backwards for a discovery job whose point is finding domains not already known -- and
 * over Brave because Brave's own docs note its independent index is smaller than Bing's and
 * that dropping Bing as a backend "may have an effect... for regional or language-specific
 * results," which matters for a niche market like Croatian local/tourism sites.
 */

export async function bingSearch(query, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("bingSearch requires an API key (BING_SEARCH_API_KEY)");
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10&mkt=hr-HR`;
  const response = await fetchImpl(url, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
  if (!response.ok) throw new Error(`bing-search-http-error:${response.status}`);
  const body = await response.json();
  return (body.webPages?.value || []).map((r) => ({ title: r.name, url: r.url, snippet: r.snippet }));
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
