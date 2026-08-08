import { normalizeText, tokenize, jaccardScore, tokenOverlapCount, eventTitle } from "./normalize.mjs";

/**
 * Fuzzy-duplicate scoring, ported faithfully from scripts/classify-pending-events.ps1's
 * Get-FuzzyDuplicateMatches (proven weights, not redesigned) so a candidate that's really
 * just a re-discovery of an event already on the live site gets caught regardless of which
 * source (or extraction method) found it this time.
 *
 * Returns the top-5 matches scoring >= 0.62 with a corroborating signal beyond just the score
 * (see `isLikelyDuplicate`) -- same bar the existing pipeline has used successfully.
 */
export function findFuzzyDuplicates(candidateEvent, existingEvents) {
  if (!candidateEvent?.date) return [];

  const candidateTitle = eventTitle(candidateEvent);
  const candidateTokens = tokenize(candidateTitle);
  const candidateVenue = normalizeText(candidateEvent.venue);
  const candidateTown = candidateEvent.town || "";
  const candidateTime = candidateEvent.time || "";
  const candidateEnd = candidateEvent.endDate || candidateEvent.date;

  const matches = [];

  for (const existing of existingEvents) {
    if (!existing.date) continue;
    const sameDate = existing.date === candidateEvent.date;
    const existingEnd = existing.endDate || existing.date;
    const rangeOverlap = existing.date <= candidateEnd && candidateEvent.date <= existingEnd;
    if (!sameDate && !rangeOverlap) continue;

    let score = 0;
    const reasons = [];
    if (sameDate) { score += 0.30; reasons.push("same date"); }
    else if (rangeOverlap) { score += 0.18; reasons.push("date within existing range"); }

    if (candidateTown && existing.town && existing.town === candidateTown) {
      score += 0.15;
      reasons.push("same town");
    }

    const categoryOverlap = Array.isArray(candidateEvent.cats) && Array.isArray(existing.cats)
      && candidateEvent.cats.some((cat) => cat && existing.cats.includes(cat));
    if (categoryOverlap) { score += 0.08; reasons.push("overlapping category"); }

    const sameTime = Boolean(candidateTime && existing.time && candidateTime === existing.time);
    if (sameTime) { score += 0.15; reasons.push("same time"); }

    const existingVenue = normalizeText(existing.venue);
    let venueMatch = false;
    if (candidateVenue && existingVenue) {
      if (candidateVenue === existingVenue) {
        venueMatch = true; score += 0.20; reasons.push("same venue");
      } else if (candidateVenue.length >= 6 && existingVenue.length >= 6
        && (candidateVenue.includes(existingVenue) || existingVenue.includes(candidateVenue))) {
        venueMatch = true; score += 0.12; reasons.push("similar venue");
      }
    }

    const existingTitle = eventTitle(existing);
    const existingTokens = tokenize(existingTitle);
    const titleScore = jaccardScore(candidateTokens, existingTokens);
    const titleOverlap = tokenOverlapCount(candidateTokens, existingTokens);
    const exactTitle = Boolean(normalizeText(candidateTitle)) && normalizeText(candidateTitle) === normalizeText(existingTitle);
    const strongTitle = exactTitle || titleScore >= 0.50 || (titleScore >= 0.34 && titleOverlap >= 2);
    if (titleScore > 0) {
      score += Math.min(0.35, titleScore * 0.35);
      if (strongTitle) reasons.push("similar title");
    }

    score = Math.round(Math.min(1, score) * 1000) / 1000;

    const isLikelyDuplicate =
      (sameDate && strongTitle && (venueMatch || sameTime || existing.town === candidateTown || titleScore >= 0.70)) ||
      (sameDate && venueMatch && sameTime) ||
      (rangeOverlap && !sameDate && strongTitle && (venueMatch || existing.town === candidateTown));

    if (score >= 0.62 && isLikelyDuplicate) {
      matches.push({ eventId: existing.id, title: existingTitle, date: existing.date, time: existing.time, venue: existing.venue, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
