/**
 * Exponential backoff with jitter. Ported from the AI Ingestion Code prototype's
 * connector-contract.mjs, where this math existed but nothing ever called it in a real retry
 * loop (it was only used to compute a number stored on a health-state object). `withRetry`
 * below is the missing piece: it actually retries a failing async call using this delay.
 */
export function computeBackoffDelay(attempt, retry, randomValue = 0.5) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new RangeError("attempt must be a positive integer");
  if (attempt > retry.maxAttempts) return null;
  if (randomValue < 0 || randomValue > 1) throw new RangeError("randomValue must be between 0 and 1");
  const exponential = Math.min(retry.maxDelayMs, retry.baseDelayMs * (2 ** (attempt - 1)));
  const jitter = 1 + ((randomValue * 2) - 1) * retry.jitterRatio;
  return Math.min(retry.maxDelayMs, Math.max(0, Math.round(exponential * jitter)));
}

const DEFAULT_RETRY = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 15000, jitterRatio: 0.2 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` (an async thunk), retrying on failure with exponential backoff. `shouldRetry`
 * lets a caller skip retrying errors that will never succeed (e.g. a 4xx from the AI API, or
 * a RetrievalBlockedError from retrieval.mjs) — retrying those just burns quota for no
 * benefit. Defaults to retrying everything.
 */
export async function withRetry(fn, { retry = DEFAULT_RETRY, shouldRetry = () => true, onRetry } = {}) {
  let lastError;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const delay = shouldRetry(error, attempt) ? computeBackoffDelay(attempt, retry) : null;
      if (delay === null) throw error;
      onRetry?.({ attempt, delay, error });
      await sleep(delay);
    }
  }
}
