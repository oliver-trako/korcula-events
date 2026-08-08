import { decodeXmlEntities } from "./text-utils.mjs";

const STRIP_TAG_BLOCKS = /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const TAG = /<[^>]+>/g;
const ANCHOR = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
// Multilingual (the page's own language is whatever the source site uses) purchase-intent
// keywords, checked against either the link's own visible text or its target URL/domain --
// a page linking out to a known ticketing platform is itself strong evidence, even when the
// link text is generic ("more info"). Deliberately narrow: this only ever preserves a link
// that already looks like a ticket link, so it can't turn an unrelated nav/social link into a
// false ticketUrl downstream (platform/ingestion/adapters/html-llm.mjs still has to recognize
// and extract it from the surrounding text -- this just keeps the href from being silently
// discarded before the model ever sees it, which is what every href used to do before this).
const TICKET_KEYWORDS = /kupi|ulaznic|karte|tickets?|buy|rezervacij|booking|biljet/i;
const TICKET_DOMAINS = /entrio|eventim|ulaznice|ticketshop|ticketmaster/i;

function preserveTicketLinks(html) {
  return html.replace(ANCHOR, (match, href, inner) => {
    const text = inner.replace(TAG, " ");
    if (!TICKET_KEYWORDS.test(text) && !TICKET_DOMAINS.test(href)) return match;
    return `${text} (ticket link: ${href})`;
  });
}

/**
 * Reduce an HTML page to plain, whitespace-collapsed text — no tags, scripts, styles, or
 * comments — for feeding to an LLM extractor (platform/ingestion/adapters/html-llm.mjs).
 * Deliberately simple (no DOM parser dependency): good enough for "here is the readable
 * content of the page," which is all the extraction prompt needs.
 *
 * maxChars found the hard way: the old 8000-char default was silently truncating real
 * program listings on content-heavy pages (pogon.hr's page is ~29,000 chars of plain text,
 * with the actual event listing running well past the old cutoff) -- the model only ever
 * saw a fragment of nav/header text and correctly reported zero events for pages that
 * genuinely had many. 24000 chars (~6k tokens) leaves headroom under llama-3.1-8b-instruct's
 * context window alongside the prompt and the 4000-token output budget in ai-client.mjs.
 */
export function htmlToPlainText(html, { maxChars = 24000 } = {}) {
  const withoutBlocks = preserveTicketLinks(String(html ?? "").replace(STRIP_TAG_BLOCKS, " ").replace(HTML_COMMENT, " "));
  const withoutTags = withoutBlocks.replace(TAG, "\n");
  const decoded = decodeXmlEntities(withoutTags);
  const collapsed = decoded
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return collapsed.length > maxChars ? `${collapsed.slice(0, maxChars)}\n[truncated]` : collapsed;
}
