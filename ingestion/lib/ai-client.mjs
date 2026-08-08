// Cloudflare Workers AI client (M6-05). Same account already used for Pages/Access/D1 —
// deliberately not GitHub Models, which was retired 2026-07-30 (docs/DECISION_LOG.md D-041).
// The completion call is injectable everywhere it's used (createWorkersAiClient is the only
// place that actually calls fetch), matching the DI pattern in retrieval.mjs and every adapter.

export class ModelCallError extends Error {
  constructor(reason) {
    super(`Model call failed: ${reason}`);
    this.name = "ModelCallError";
    this.reason = reason;
  }
}

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/**
 * @param {object} options
 * @param {string} options.accountId - Cloudflare account id.
 * @param {string} options.apiToken - Cloudflare API token with Workers AI run permission.
 * @param {string} [options.model] - defaults to a small, cheap instruct model.
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(entry: object) => void} [options.onUsage] - cost-logging hook (M6-05): called with
 *   { model, evidenceHash, promptChars, success } after every call, success or failure.
 */
export function createWorkersAiClient({ accountId, apiToken, model = DEFAULT_MODEL, fetchImpl = fetch, onUsage } = {}) {
  /**
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} jsonSchema - the expected shape of the response.
   * @param {string} [evidenceHash] - for cost/usage attribution (caching key upstream too).
   */
  async function completeJson(messages, jsonSchema, evidenceHash) {
    if (!accountId || !apiToken) {
      throw new ModelCallError("not-configured: missing Cloudflare accountId/apiToken");
    }
    const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({ messages, max_tokens: 8000, response_format: { type: "json_schema", json_schema: jsonSchema } })
      });
    } catch (error) {
      onUsage?.({ model, evidenceHash, promptChars, success: false, error: error.message });
      throw new ModelCallError(`request-failed:${error.message}`);
    }

    if (!response.ok) {
      onUsage?.({ model, evidenceHash, promptChars, success: false, status: response.status });
      throw new ModelCallError(`http-error:${response.status}`);
    }

    const body = await response.json();
    if (!body.success) {
      onUsage?.({ model, evidenceHash, promptChars, success: false, errors: body.errors });
      throw new ModelCallError(`api-error:${JSON.stringify(body.errors ?? [])}`);
    }

    onUsage?.({ model, evidenceHash, promptChars, success: true, usage: body.result?.usage ?? null });

    // Cloudflare's response shape differs by mode: plain calls return `result.response`;
    // `response_format: json_schema` calls switch to an OpenAI-compatible
    // `result.choices[0].message.content` shape instead (confirmed against the live API,
    // not just documentation — the two shapes are not interchangeable).
    const raw = body.result?.response ?? body.result?.choices?.[0]?.message?.content;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new ModelCallError("response-not-valid-json");
    }
  }

  return { completeJson };
}

const DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

/**
 * Cloudflare Workers AI vision client (D-046 poster reading). Vision models take raw image
 * bytes under `image` rather than a `messages` array, and — unlike the text client above —
 * don't reliably support `response_format: json_schema`, so this returns the model's raw
 * text; callers parse it leniently and must never trust the result as more than a
 * corroborating signal for facts already extracted from a source's own page text.
 */
export function createWorkersAiVisionClient({ accountId, apiToken, model = DEFAULT_VISION_MODEL, fetchImpl = fetch, onUsage } = {}) {
  async function describeImage(imageBytes, prompt) {
    if (!accountId || !apiToken) {
      throw new ModelCallError("not-configured: missing Cloudflare accountId/apiToken");
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({ image: Array.from(imageBytes), prompt, max_tokens: 512 })
      });
    } catch (error) {
      onUsage?.({ model, success: false, error: error.message });
      throw new ModelCallError(`request-failed:${error.message}`);
    }

    if (!response.ok) {
      onUsage?.({ model, success: false, status: response.status });
      throw new ModelCallError(`http-error:${response.status}`);
    }

    const body = await response.json();
    if (!body.success) {
      onUsage?.({ model, success: false, errors: body.errors });
      throw new ModelCallError(`api-error:${JSON.stringify(body.errors ?? [])}`);
    }
    onUsage?.({ model, success: true, usage: body.result?.usage ?? null });
    return body.result?.description ?? body.result?.response ?? "";
  }

  return { describeImage };
}

/**
 * Vision models aren't schema-constrained, so a description prompted to answer in JSON can
 * still wrap it in prose. Extract the first balanced-looking `{...}` block and parse it;
 * anything that doesn't parse yields `null` rather than a guess.
 */
export function parseLenientJson(text) {
  const match = /\{[\s\S]*\}/.exec(String(text ?? ""));
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
