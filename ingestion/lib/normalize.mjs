/**
 * Text normalization helpers, ported from scripts/classify-pending-events.ps1's proven
 * duplicate-scoring logic (Normalize-Text / Get-TokenSet) rather than the AI Ingestion Code
 * prototype's version, which depended on a `../entities/normalize.mjs` file that doesn't exist
 * in that drop.
 */

const IGNORED_TOKENS = new Set([
  "the", "and", "or", "in", "at", "of", "for", "with", "by", "a", "an",
  "kino", "concert", "koncert", "festival", "event", "events", "korcula"
]);

const TOKEN_ALIASES = {
  theodor: "theodore", theodors: "theodore", todor: "theodore", todora: "theodore",
  festivity: "feast", festivities: "feast",
  workshops: "workshop", programming: "program"
};

/** Lowercase, strip diacritics, collapse to a-z0-9 tokens separated by single spaces. */
export function normalizeText(text) {
  if (!text) return "";
  const decomposed = String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return decomposed.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Tokenizes normalized text into a Set, dropping stopwords, year-tokens, and short words. */
export function tokenize(text) {
  const tokens = normalizeText(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => TOKEN_ALIASES[t] || t)
    .filter((t) => t.length > 2 && !IGNORED_TOKENS.has(t) && !/^(19|20)\d{2}$/.test(t));
  return new Set(tokens);
}

export function jaccardScore(left, right) {
  if (!left?.size || !right?.size) return 0;
  const union = new Set([...left, ...right]);
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return union.size === 0 ? 0 : intersection / union.size;
}

export function tokenOverlapCount(left, right) {
  if (!left?.size || !right?.size) return 0;
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

export function eventTitle(event) {
  return event?.en || event?.hr || event?.id || "";
}

/** Parses a "€/EUR/kn/free" style raw price string into a normalized shape. Best-effort. */
export function normalizePrice(raw) {
  if (!raw) return { amount: null, currency: null, isFree: false, raw: raw ?? null };
  const text = String(raw).trim();
  if (/\b(free|besplat[nio]*|ulaz slobodan)\b/i.test(text)) {
    return { amount: null, currency: null, isFree: true, raw: text };
  }
  const match = /([\d.,]+)\s*(eur|€|kn|hrk|usd|\$)?/i.exec(text);
  if (!match) return { amount: null, currency: null, isFree: false, raw: text };
  const amount = Number.parseFloat(match[1].replace(",", "."));
  const currencyMap = { eur: "EUR", "€": "EUR", kn: "HRK", hrk: "HRK", usd: "USD", $: "USD" };
  const currency = match[2] ? currencyMap[match[2].toLowerCase()] || null : null;
  return { amount: Number.isFinite(amount) ? amount : null, currency, isFree: false, raw: text };
}
