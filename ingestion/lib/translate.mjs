/**
 * Fills in languages the extractor left blank with a real translation, rather than the
 * same-language stand-in extract.mjs's resolveLang() falls back to. Only called for the minority
 * of candidates that actually have a blank language -- most extractions get all 6 right in the
 * single extraction call, so this is a targeted repair, not a second pass over everything.
 */

const LANG_NAMES = { hr: "Croatian", en: "English", de: "German", it: "Italian", sl: "Slovenian", fr: "French" };

function schema(missingLangs) {
  return {
    name: "korcula_translation_fill",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: missingLangs,
      properties: Object.fromEntries(missingLangs.map((l) => [l, { type: "string", description: `Faithful ${LANG_NAMES[l]} translation of the given title -- translate the meaning, don't just copy the source text.` }]))
    }
  };
}

/**
 * @param {object} candidate - an event as mapped by extract.mjs (already has resolveLang stand-ins).
 * @param {string[]} missingLangs - which of candidate's language fields were genuinely blank (candidate._missingLangs).
 * @param {object} options - { completeJson, evidenceHash }
 * @returns {Promise<Record<string,string>>} translations for the requested languages, or {} on failure (caller keeps the stand-in).
 */
export async function translateMissingLangs(candidate, missingLangs, { completeJson, evidenceHash } = {}) {
  if (typeof completeJson !== "function") throw new Error("translateMissingLangs requires a completeJson function");
  if (!missingLangs?.length) return {};

  // Translate from whichever anchor language is real (not itself a stand-in) -- hr/en are the
  // only two the hard floor guarantees at least one of, so one of them is always genuine.
  const sourceLang = candidate.hr?.trim() && !missingLangs.includes("hr") ? "hr" : "en";
  const sourceText = candidate[sourceLang];
  if (!sourceText?.trim()) return {};

  const messages = [
    { role: "system", content: "Translate the given event title faithfully into each requested language. Return only the translations -- no commentary, no explanation." },
    { role: "user", content: `Title (${LANG_NAMES[sourceLang]}): ${sourceText}\n\nTranslate into: ${missingLangs.map((l) => LANG_NAMES[l]).join(", ")}` }
  ];

  const result = await completeJson(messages, schema(missingLangs), evidenceHash);
  const filled = {};
  for (const l of missingLangs) if (typeof result?.[l] === "string" && result[l].trim()) filled[l] = result[l].trim();
  return filled;
}
