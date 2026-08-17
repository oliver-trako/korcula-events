/**
 * Minimal robots.txt compliance -- a well-behaved crawler checks this before fetching, full
 * stop. Deliberately simple: parses `Disallow`/`Allow` lines under a `User-agent: *` block
 * (we identify as a normal browser via headers, so there's no separate bot-specific block to
 * also match) and a `Crawl-delay` if present. Doesn't handle wildcards/`$` end-anchors in paths --
 * every source here is a small tourism/venue site with simple robots.txt files, and the goal is
 * "don't fetch a path the site asked crawlers to skip," not full RFC 9309 compliance.
 */

const cache = new Map(); // origin -> { rules, crawlDelayMs } | null (robots.txt missing/unfetchable)

function parseRobotsTxt(text) {
  const lines = text.split(/\r?\n/);
  const rules = []; // { path, allow }
  let inWildcardBlock = false;
  let crawlDelayMs = null;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawField, ...rest] = line.split(":");
    const field = rawField.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      inWildcardBlock = value === "*";
      continue;
    }
    if (!inWildcardBlock) continue;

    if (field === "disallow" && value) rules.push({ path: value, allow: false });
    else if (field === "allow" && value) rules.push({ path: value, allow: true });
    else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) crawlDelayMs = seconds * 1000;
    }
  }
  return { rules, crawlDelayMs };
}

/**
 * @returns {Promise<{allowed: boolean, crawlDelayMs: number|null}>}
 */
export async function checkRobotsTxt(fetchResource, url, retrievalConfig, requestHeaders) {
  const target = new URL(url);
  const origin = `${target.protocol}//${target.host}`;

  if (!cache.has(origin)) {
    let parsed = null;
    try {
      const res = await fetchResource(
        `${origin}/robots.txt`,
        { ...retrievalConfig, allowedHosts: [target.hostname], acceptedContentTypes: ["text/plain", "text/html"] },
        { headers: requestHeaders }
      );
      if (res.status < 400 && typeof res.body === "string") parsed = parseRobotsTxt(res.body);
    } catch {
      // No robots.txt, or it errored/timed out -- treat as "no restrictions stated" rather than
      // blocking a source outright over an unfetchable robots.txt (most of these small sites
      // don't have one at all).
    }
    cache.set(origin, parsed);
  }

  const entry = cache.get(origin);
  if (!entry) return { allowed: true, crawlDelayMs: null };

  const path = target.pathname + (target.search || "");
  // Longest-matching-rule wins, per the de-facto convention most robots.txt parsers follow
  // (Google's included) -- not first-match, since a site commonly lists a broad Disallow
  // followed by a narrower Allow carving out an exception.
  let best = null;
  for (const rule of entry.rules) {
    if (path.startsWith(rule.path) && (!best || rule.path.length > best.path.length)) best = rule;
  }
  return { allowed: !best || best.allow, crawlDelayMs: entry.crawlDelayMs };
}
