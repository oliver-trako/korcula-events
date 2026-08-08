import { findFuzzyDuplicates } from "./duplicate-check.mjs";

/**
 * The auto-publish/review decision. Two independent AI passes (extract.mjs, verify.mjs)
 * agreeing is the trust mechanism per the approved design -- source type is not consulted
 * here at all, except via ingestion-policy.json's sourceOverrides.alwaysReview escape hatch.
 * Objective fact checks are a hard floor that no verifier confidence can override.
 *
 * @param {object} candidate - output of extract.mjs (one event).
 * @param {object} verifierResult - output of verify.mjs: { confidence, concerns }.
 * @param {object[]} existingEvents - live site/data/events.json events, for duplicate/id checks.
 * @param {object} policy - ingestion/data/ingestion-policy.json, parsed.
 * @param {string} sourceId - which source produced this candidate, for sourceOverrides.
 * @param {Date} now - injectable for testing.
 * @returns {{ decision: "publish"|"review", blockingReasons: string[], duplicateMatches: object[] }}
 */
export function decideCandidate(candidate, verifierResult, existingEvents, policy, sourceId, now = new Date()) {
  const floor = policy.hardFloor;
  const blockingReasons = [];

  for (const field of floor.requiredEventFields) {
    const value = candidate[field];
    const missing = value === undefined || value === null || (typeof value === "string" && !value.trim())
      || (Array.isArray(value) && value.length === 0);
    if (missing) blockingReasons.push(`missing-${field}`);
  }

  if (blockingReasons.length === 0) {
    if (floor.autoRejectPastEvents) {
      const endOrDate = candidate.endDate || candidate.date;
      const todayStr = now.toISOString().slice(0, 10);
      if (endOrDate < todayStr) blockingReasons.push("past-event");
    }

    if (floor.blockedIfDateAmbiguous && candidate.time && /tbc|varies|evening|morning|afternoon/i.test(candidate.time)) {
      blockingReasons.push("ambiguous-time");
    }

    if (floor.blockedIfDuplicateId && candidate.id && existingEvents.some((e) => e.id === candidate.id)) {
      blockingReasons.push("duplicate-id");
    }
  }

  const duplicateMatches = blockingReasons.length === 0 && floor.blockedIfFuzzyDuplicate
    ? findFuzzyDuplicates(candidate, existingEvents)
    : [];
  if (duplicateMatches.some((m) => m.score >= floor.fuzzyDuplicateScoreThreshold)) {
    blockingReasons.push("fuzzy-duplicate");
  }

  const forcedReview = policy.sourceOverrides?.alwaysReview?.includes(sourceId);
  if (forcedReview) blockingReasons.push("source-override-always-review");

  const confidenceOk = policy.aiVerification?.enabled
    && verifierResult.confidence >= policy.aiVerification.autoPublishConfidenceThreshold;
  if (!confidenceOk) blockingReasons.push(`verifier-confidence-below-threshold:${verifierResult.confidence}`);

  const decision = blockingReasons.length === 0 ? "publish" : "review";
  return { decision, blockingReasons, duplicateMatches };
}
