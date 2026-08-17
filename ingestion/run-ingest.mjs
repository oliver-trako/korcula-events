#!/usr/bin/env node
/**
 * Top-level ingestion orchestrator: fetch every HTML/ticketing source in sources.json,
 * extract candidate events with AI, verify each one with an independent second AI pass,
 * decide publish-vs-review against the hard floor + verifier confidence, then either merge
 * straight into site/data/events.json or roll into a GitHub Issue for human review.
 *
 * Usage:
 *   node ingestion/run-ingest.mjs            # live run: publishes + opens issues
 *   node ingestion/run-ingest.mjs --shadow   # dry run: writes ingestion/data/run-log/ only
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSafeRetrievalClient } from "./lib/retrieval.mjs";
import { createWorkersAiClient } from "./lib/ai-client.mjs";
import { extractEventsFromHtml, TOWNS, CATS } from "./lib/extract.mjs";
import { verifyCandidate } from "./lib/verify.mjs";
import { translateMissingLangs } from "./lib/translate.mjs";
import { decideCandidate } from "./lib/decide.mjs";
import { findFuzzyDuplicates } from "./lib/duplicate-check.mjs";
import { withRetry, sleep } from "./lib/backoff.mjs";
import { openReviewIssue, findOrCreateRunLogIssue, postRunLogComment } from "./lib/github-issue.mjs";
import { checkRobotsTxt } from "./lib/robots.mjs";
import { htmlToPlainText } from "./lib/html-text.mjs";
import { normalizeText } from "./lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const EVENTS_PATH = path.join(REPO_ROOT, "site", "data", "events.json");

const FETCHABLE_SCRAPE_MODES = new Set(["html", "ticketing"]);
const RETRIEVAL_CONFIG = {
  timeoutMs: 20_000,
  maxBytes: 5_000_000,
  maxRedirects: 5,
  acceptedContentTypes: ["text/html", "application/xhtml+xml"]
};

// A run that hit persistent 429s from Cloudflare Workers AI (2026-08-09) showed every single
// call failing, including the very first -- a sign the account's per-minute (or daily) budget
// was already tight, not that this pipeline was bursting requests. Two independent mitigations:
// a minimum spacing between calls so we never hammer the API back-to-back regardless of retries,
// and much more patient retries specifically for AI calls (5 attempts, longer backoff, and
// honoring Cloudflare's own Retry-After header via ai-client.mjs's error.retryAfterMs when present).
const MIN_MS_BETWEEN_AI_CALLS = 1500;
const AI_RETRY = { maxAttempts: 5, baseDelayMs: 3000, maxDelayMs: 60_000, jitterRatio: 0.2 };
const AI_RETRY_OPTIONS = {
  retry: AI_RETRY,
  shouldRetry: (err) => err.name === "ModelCallError" && !err.reason?.startsWith("api-error"),
  retryAfterMs: (err) => err.retryAfterMs
};

// Wraps completeJson so calls are spaced at least MIN_MS_BETWEEN_AI_CALLS apart, independent of
// retry backoff -- cheap insurance against rate limits even when every individual call succeeds.
function throttle(fn, minIntervalMs) {
  let nextAvailableAt = 0;
  return async (...args) => {
    const wait = nextAvailableAt - Date.now();
    if (wait > 0) await sleep(wait);
    nextAvailableAt = Date.now() + minIntervalMs;
    return fn(...args);
  };
}

// retrieval.mjs sends no headers unless given some, which means no User-Agent at all -- Node's
// https.request doesn't set a default one. That's an obvious "not a browser" tell that trips
// even basic bot-detection, independent of any IP-reputation blocking. An ordinary browser's
// headers (real Chrome/Windows UA, standard Accept/Accept-Language with Croatian first since
// every source here is a Croatian site) fix that specific, legitimate gap -- this is normal
// HTTP practice, not evasion of anything: it's what every real visitor to these pages sends.
const REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7"
};

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function slugify(text) {
  return normalizeText(text).replace(/\s+/g, "-").slice(0, 60);
}

function generateCandidateId(sourceId, candidate) {
  return `ai-${sourceId}-${candidate.date}-${slugify(candidate.en || candidate.hr)}`;
}

// A same-site www<->apex redirect (e.g. adriaticpearlkorcula.com -> www.adriaticpearlkorcula.com)
// is extremely common and completely harmless, but retrieval.mjs's redirect-hop allowlist
// check is (deliberately) exact-hostname-only -- so without this, real sources fail with
// "host-not-allowlisted" the moment they redirect to their own www/apex variant. Allowing both
// forms of the *same* registrable domain preserves the actual SSRF protection (still restricted
// to this one known domain family, not arbitrary hosts) while tolerating that redirect.
function hostnameVariants(hostname) {
  return hostname.startsWith("www.") ? [hostname, hostname.slice(4)] : [hostname, `www.${hostname}`];
}

// Per-host "don't fetch again before this timestamp", so a good-citizen minimum gap applies
// between requests to the *same* site regardless of how sources.json orders/interleaves URLs --
// a site's own robots.txt Crawl-delay (if present and longer) takes priority over the default.
const hostNextFetchAt = new Map();
const DEFAULT_MIN_MS_BETWEEN_HOST_FETCHES = 2000;

async function processUrlEntry(source, urlEntry, ctx) {
  const { retrievalClient, aiClient, existingEvents, policy, log } = ctx;
  const hostname = new URL(urlEntry.url).hostname;

  const robotsCheck = await checkRobotsTxt(retrievalClient.fetchResource, urlEntry.url, RETRIEVAL_CONFIG, REQUEST_HEADERS);
  if (!robotsCheck.allowed) {
    log.sources.push({ sourceId: source.id, url: urlEntry.url, skippedByRobotsTxt: true, published: 0, review: 0 });
    return { published: [], review: [] };
  }

  const minGapMs = Math.max(DEFAULT_MIN_MS_BETWEEN_HOST_FETCHES, robotsCheck.crawlDelayMs || 0);
  const waitMs = (hostNextFetchAt.get(hostname) || 0) - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  hostNextFetchAt.set(hostname, Date.now() + minGapMs);

  let fetched;
  try {
    fetched = await withRetry(
      () => retrievalClient.fetchResource(
        urlEntry.url,
        { ...RETRIEVAL_CONFIG, allowedHosts: hostnameVariants(hostname) },
        { headers: REQUEST_HEADERS }
      ),
      { shouldRetry: (err) => err.name !== "RetrievalBlockedError" || err.reason?.startsWith("timeout") }
    );
  } catch (error) {
    log.errors.push({ sourceId: source.id, url: urlEntry.url, stage: "fetch", error: error.message });
    return { published: [], review: [] };
  }
  if (fetched.status === 304) return { published: [], review: [] };

  const pageText = htmlToPlainText(fetched.body);

  let extracted;
  try {
    extracted = await withRetry(
      () => extractEventsFromHtml(fetched.body, {
        completeJson: aiClient.completeJson,
        pageUrl: urlEntry.url,
        evidenceHash: fetched.contentHash,
        // Visibility into candidates the model proposed but our own post-filter discarded --
        // without this, "the model found nothing" and "the model found something we then
        // silently dropped" were indistinguishable from the run log alone.
        onRejected: ({ candidate, reason }) => log.rejectedCandidates.push({ sourceId: source.id, url: urlEntry.url, reason, candidate })
      }),
      AI_RETRY_OPTIONS
    );
  } catch (error) {
    log.errors.push({ sourceId: source.id, url: urlEntry.url, stage: "extract", error: error.message });
    return { published: [], review: [] };
  }

  const published = [];
  const review = [];

  for (const candidate of extracted) {
    candidate.id = generateCandidateId(source.id, candidate);

    if (candidate._missingLangs?.length) {
      try {
        const filled = await withRetry(
          () => translateMissingLangs(candidate, candidate._missingLangs, { completeJson: aiClient.completeJson, evidenceHash: fetched.contentHash }),
          AI_RETRY_OPTIONS
        );
        Object.assign(candidate, filled);
      } catch (error) {
        // Not fatal -- extract.mjs's resolveLang already put a same-language stand-in in place,
        // so a failed translation just means that stand-in ships instead of a real translation.
        log.errors.push({ sourceId: source.id, url: urlEntry.url, stage: "translate", candidateId: candidate.id, error: error.message });
      }
      delete candidate._missingLangs;
    }

    let verifierResult;
    try {
      verifierResult = await withRetry(
        () => verifyCandidate(candidate, pageText, { completeJson: aiClient.completeJson, evidenceHash: fetched.contentHash }),
        AI_RETRY_OPTIONS
      );
    } catch (error) {
      log.errors.push({ sourceId: source.id, url: urlEntry.url, stage: "verify", candidateId: candidate.id, error: error.message });
      verifierResult = { confidence: 0, concerns: [`verifier call failed: ${error.message}`] };
    }

    const { decision, blockingReasons, duplicateMatches } = decideCandidate(
      candidate, verifierResult, [...existingEvents, ...published], policy, source.id
    );

    const record = { candidate, verifierResult, blockingReasons, duplicateMatches, sourceId: source.id, sourceUrl: urlEntry.url };
    if (decision === "publish") published.push(record);
    else review.push(record);
  }

  return { published, review };
}

async function run({ shadow }) {
  const sourcesDoc = await readJson(path.join(DATA_DIR, "sources.json"));
  const policy = await readJson(path.join(DATA_DIR, "ingestion-policy.json"));
  const eventsDoc = await readJson(EVENTS_PATH);
  const pendingPath = path.join(DATA_DIR, "pending-events.json");
  const pendingDoc = await readJson(pendingPath);
  // Real production incident (2026-08-16): a candidate manually confirmed wrong and deleted
  // from events.json got re-extracted with the same deterministic id and auto-published again
  // on the very next run, since decide.mjs's duplicate-id check only ever looked at events
  // currently live -- deleting one taught the pipeline nothing. Folding this permanent rejection
  // list's ids in as bare id-only stubs lets that same existing duplicate-id check catch them
  // for free, with no change to decide.mjs itself.
  const rejectedDoc = await readJson(path.join(DATA_DIR, "rejected-candidates.json"));
  const rejectedStubs = (rejectedDoc.ids || []).map((r) => ({ id: r.id }));

  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfApiToken = process.env.CF_API_TOKEN;
  if (!cfAccountId || !cfApiToken) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set (Cloudflare Workers AI credentials).");
  }

  const retrievalClient = createSafeRetrievalClient();
  const usageLog = [];
  const rawAiClient = createWorkersAiClient({
    accountId: cfAccountId,
    apiToken: cfApiToken,
    onUsage: (entry) => usageLog.push(entry)
  });
  const aiClient = { completeJson: throttle(rawAiClient.completeJson, MIN_MS_BETWEEN_AI_CALLS) };

  const log = { runDate: new Date().toISOString().slice(0, 10), shadow, sources: [], errors: [], rejectedCandidates: [] };
  const allPublished = [];
  const allReview = [];

  for (const source of sourcesDoc.sources) {
    const fetchableUrls = (source.urls || []).filter((u) => FETCHABLE_SCRAPE_MODES.has(u.scrapeMode));
    for (const urlEntry of fetchableUrls) {
      const { published, review } = await processUrlEntry(source, urlEntry, {
        retrievalClient, aiClient, existingEvents: [...eventsDoc.events, ...rejectedStubs], policy, log
      });
      allPublished.push(...published);
      allReview.push(...review);
      log.sources.push({ sourceId: source.id, url: urlEntry.url, published: published.length, review: review.length });
    }
  }

  log.totals = { published: allPublished.length, review: allReview.length, aiCalls: usageLog.length };
  log.aiUsage = usageLog;
  log.published = allPublished.map(({ candidate }) => ({ id: candidate.id, en: candidate.en, date: candidate.date, town: candidate.town }));

  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const token = process.env.GITHUB_TOKEN;

  // Always posted, shadow or live, whether or not anything needs review -- this is what
  // answers "can I get a verbose log in the email GitHub sends me": GitHub's own workflow
  // status email is a fixed template with no room for custom content, but a comment on an
  // issue you're subscribed to arrives as its own email with the full comment body inline.
  async function postRunLog() {
    if (!(owner && repo && token)) {
      console.log("GITHUB_REPOSITORY/GITHUB_TOKEN not set -- skipped posting the run-log comment.");
      return null;
    }
    try {
      const trackingIssue = await findOrCreateRunLogIssue({ owner, repo, token });
      await postRunLogComment(trackingIssue.number, log, { owner, repo, token });
      console.log(`Posted run log to ${trackingIssue.url}`);
      return trackingIssue.url;
    } catch (error) {
      log.errors.push({ stage: "post-run-log", error: error.message });
      console.error(`Failed to post run-log comment: ${error.message}`);
      return null;
    }
  }

  // GitHub Actions renders whatever markdown gets appended to $GITHUB_STEP_SUMMARY directly on
  // the run's own page -- useful alongside (not instead of) the issue-comment email, since it's
  // the first thing visible when you open a run without digging through raw log output.
  async function writeStepSummary(runLog, trackingIssueUrl) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    const { totals, published, errors } = runLog;
    const lines = [
      `## Event ingestion — ${runLog.runDate}${runLog.shadow ? " (shadow)" : ""}`,
      "",
      `| Published | Needs review | AI calls | Errors |`,
      `|---|---|---|---|`,
      `| ${totals.published} | ${totals.review} | ${totals.aiCalls} | ${errors.length} |`,
      ""
    ];
    if (trackingIssueUrl) lines.push(`**[Full run log →](${trackingIssueUrl})**`, "");
    if (owner && repo) lines.push(`[Pending candidates (raw)](https://github.com/${owner}/${repo}/blob/main/ingestion/data/pending-events.json)`, "");
    if (published?.length) {
      lines.push("**Published:**");
      for (const p of published) lines.push(`- ${p.en} (${p.date}, ${p.town})`);
      lines.push("");
    }
    if (errors.length) {
      lines.push(`**Errors:** ${errors.length} -- see the run log linked above for detail.`);
    }
    await fs.appendFile(summaryPath, lines.join("\n") + "\n");
  }

  if (shadow) {
    const logDir = path.join(DATA_DIR, "run-log");
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(path.join(logDir, `${log.runDate}-shadow.json`), JSON.stringify(log, null, 2) + "\n");
    console.log(`[shadow] ${allPublished.length} would publish, ${allReview.length} would need review. See ingestion/data/run-log/${log.runDate}-shadow.json`);
    const trackingIssueUrl = await postRunLog();
    await writeStepSummary(log, trackingIssueUrl);
    return;
  }

  if (allPublished.length) {
    for (const { candidate } of allPublished) {
      const { extractionMethod, ...event } = candidate;
      event.updatedAt = log.runDate;
      eventsDoc.events.push(event);
    }
    eventsDoc.events.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")) || a.id.localeCompare(b.id));
    await writeJson(EVENTS_PATH, eventsDoc);
    console.log(`Published ${allPublished.length} event(s) to site/data/events.json:`);
    for (const { candidate } of allPublished) console.log(`  - ${candidate.id}: ${candidate.en} (${candidate.date}, ${candidate.town})`);
  }

  if (allReview.length) {
    // Real production incident: the same handful of unresolved candidates (the same source
    // page, re-fetched run after run) got appended to pending-events.json and re-issued as a
    // brand-new GitHub Issue on every single run -- pending-events.json grew unbounded and the
    // review-issue list became exactly the silent, ever-growing backlog this whole review
    // system was built to avoid. A candidate that fuzzy-matches one already sitting in
    // pending-events.json with status "needs-review" is not new information; skip it instead
    // of re-queuing and re-notifying for something a human hasn't had a chance to act on yet.
    const alreadyPending = pendingDoc.candidates.filter((c) => c.status === "needs-review").map((c) => c.event);
    const freshReview = allReview.filter((r) => findFuzzyDuplicates(r.candidate, alreadyPending).length === 0);
    const skippedAsAlreadyPending = allReview.length - freshReview.length;
    if (skippedAsAlreadyPending) {
      console.log(`${skippedAsAlreadyPending} candidate(s) skipped -- already sitting in pending-events.json awaiting review.`);
    }

    if (freshReview.length) {
      pendingDoc.candidates.push(...freshReview.map((r) => ({
        id: r.candidate.id,
        sourceId: r.sourceId,
        sourceUrl: r.sourceUrl,
        discoveredAt: new Date().toISOString(),
        extractionMethod: "ai",
        event: r.candidate,
        verifierConfidence: r.verifierResult.confidence,
        verifierConcerns: r.verifierResult.concerns,
        blockingReasons: r.blockingReasons,
        duplicateMatches: r.duplicateMatches,
        status: "needs-review"
      })));
      await writeJson(pendingPath, pendingDoc);

      if (owner && repo && token) {
        // Deliberately caught, not allowed to throw out of run(): the notification is a
        // convenience on top of already-correct, already-written files (events.json,
        // pending-events.json above) -- a GitHub API hiccup here must never discard real,
        // already-decided work the way it did in the incident this comment replaces (see
        // ingestion/data/run-log/ for that run: a >65536-char issue body threw, which skipped
        // the workflow's commit step entirely and silently lost a correctly-published event).
        try {
          const issue = await openReviewIssue(freshReview, { owner, repo, token, runDate: log.runDate });
          console.log(`Opened review issue: ${issue?.url}`);
        } catch (error) {
          log.errors.push({ stage: "open-review-issue", error: error.message });
          console.error(`Failed to open review issue (candidates are still saved in pending-events.json): ${error.message}`);
        }
      } else {
        console.log(`${freshReview.length} candidate(s) need review, but GITHUB_REPOSITORY/GITHUB_TOKEN are not set -- skipped opening an issue.`);
      }
    }
  }

  const logDir = path.join(DATA_DIR, "run-log");
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(path.join(logDir, `${log.runDate}.json`), JSON.stringify(log, null, 2) + "\n");
  const trackingIssueUrl = await postRunLog();
  await writeStepSummary(log, trackingIssueUrl);
}

const shadow = process.argv.includes("--shadow");
run({ shadow }).catch((error) => {
  console.error(error);
  process.exit(1);
});
