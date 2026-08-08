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
import { decideCandidate } from "./lib/decide.mjs";
import { withRetry } from "./lib/backoff.mjs";
import { openReviewIssue } from "./lib/github-issue.mjs";
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

async function processUrlEntry(source, urlEntry, ctx) {
  const { retrievalClient, aiClient, existingEvents, policy, log } = ctx;
  const hostname = new URL(urlEntry.url).hostname;

  let fetched;
  try {
    fetched = await withRetry(
      () => retrievalClient.fetchResource(urlEntry.url, { ...RETRIEVAL_CONFIG, allowedHosts: [hostname] }),
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
        evidenceHash: fetched.contentHash
      }),
      { shouldRetry: (err) => err.name === "ModelCallError" && !err.reason?.startsWith("api-error") }
    );
  } catch (error) {
    log.errors.push({ sourceId: source.id, url: urlEntry.url, stage: "extract", error: error.message });
    return { published: [], review: [] };
  }

  const published = [];
  const review = [];

  for (const candidate of extracted) {
    candidate.id = generateCandidateId(source.id, candidate);

    let verifierResult;
    try {
      verifierResult = await withRetry(
        () => verifyCandidate(candidate, pageText, { completeJson: aiClient.completeJson, evidenceHash: fetched.contentHash }),
        { shouldRetry: (err) => err.name === "ModelCallError" && !err.reason?.startsWith("api-error") }
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

  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfApiToken = process.env.CF_API_TOKEN;
  if (!cfAccountId || !cfApiToken) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set (Cloudflare Workers AI credentials).");
  }

  const retrievalClient = createSafeRetrievalClient();
  const usageLog = [];
  const aiClient = createWorkersAiClient({
    accountId: cfAccountId,
    apiToken: cfApiToken,
    onUsage: (entry) => usageLog.push(entry)
  });

  const log = { runDate: new Date().toISOString().slice(0, 10), shadow, sources: [], errors: [] };
  const allPublished = [];
  const allReview = [];

  for (const source of sourcesDoc.sources) {
    const fetchableUrls = (source.urls || []).filter((u) => FETCHABLE_SCRAPE_MODES.has(u.scrapeMode));
    for (const urlEntry of fetchableUrls) {
      const { published, review } = await processUrlEntry(source, urlEntry, {
        retrievalClient, aiClient, existingEvents: eventsDoc.events, policy, log
      });
      allPublished.push(...published);
      allReview.push(...review);
      log.sources.push({ sourceId: source.id, url: urlEntry.url, published: published.length, review: review.length });
    }
  }

  log.totals = { published: allPublished.length, review: allReview.length, aiCalls: usageLog.length };
  log.aiUsage = usageLog;

  if (shadow) {
    const logDir = path.join(DATA_DIR, "run-log");
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(path.join(logDir, `${log.runDate}-shadow.json`), JSON.stringify(log, null, 2) + "\n");
    console.log(`[shadow] ${allPublished.length} would publish, ${allReview.length} would need review. See ingestion/data/run-log/${log.runDate}-shadow.json`);
    return;
  }

  if (allPublished.length) {
    for (const { candidate } of allPublished) {
      const { extractionMethod, ...event } = candidate;
      event.updatedAt = log.runDate;
      eventsDoc.events.push(event);
    }
    eventsDoc.events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.id.localeCompare(b.id));
    await writeJson(EVENTS_PATH, eventsDoc);
    console.log(`Published ${allPublished.length} event(s) to site/data/events.json.`);
  }

  if (allReview.length) {
    pendingDoc.candidates.push(...allReview.map((r) => ({
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

    const owner = process.env.GITHUB_REPOSITORY_OWNER;
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    const token = process.env.GITHUB_TOKEN;
    if (owner && repo && token) {
      const issue = await openReviewIssue(allReview, { owner, repo, token, runDate: log.runDate });
      console.log(`Opened review issue: ${issue?.url}`);
    } else {
      console.log(`${allReview.length} candidate(s) need review, but GITHUB_REPOSITORY/GITHUB_TOKEN are not set -- skipped opening an issue.`);
    }
  }

  const logDir = path.join(DATA_DIR, "run-log");
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(path.join(logDir, `${log.runDate}.json`), JSON.stringify(log, null, 2) + "\n");
}

const shadow = process.argv.includes("--shadow");
run({ shadow }).catch((error) => {
  console.error(error);
  process.exit(1);
});
