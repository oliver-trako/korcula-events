#!/usr/bin/env node
/**
 * Phase 4 entrypoint, run monthly (see .github/workflows/event-ingestion.yml). Searches for
 * new Korčula-island source pages, writes non-duplicate candidates to discovered-sources.json,
 * and opens a 'source-review' GitHub Issue -- never auto-adds to sources.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverNewSources, googleSearch } from "./lib/discover-sources.mjs";
import { openSourceReviewIssue } from "./lib/github-issue.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function run() {
  const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!googleApiKey || !googleSearchEngineId) {
    console.log("GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_ENGINE_ID are not set -- skipping source discovery this run.");
    return;
  }

  const sourcesPath = path.join(DATA_DIR, "sources.json");
  const discoveredPath = path.join(DATA_DIR, "discovered-sources.json");
  const [sources, discoveredDoc] = await Promise.all([readJson(sourcesPath), readJson(discoveredPath)]);

  const alreadyDiscovered = new Set(discoveredDoc.candidates.map((c) => c.url));
  const found = await discoverNewSources(sources, {
    searchImpl: (query) => googleSearch(query, { apiKey: googleApiKey, searchEngineId: googleSearchEngineId })
  });
  const newOnes = found.filter((c) => !alreadyDiscovered.has(c.url)).map((c) => ({ ...c, status: "candidate", discoveredAt: new Date().toISOString() }));

  if (!newOnes.length) {
    console.log("No new sources found this run.");
    return;
  }

  discoveredDoc.candidates.push(...newOnes);
  await writeJson(discoveredPath, discoveredDoc);

  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const token = process.env.GITHUB_TOKEN;
  const runDate = new Date().toISOString().slice(0, 10);
  if (owner && repo && token) {
    const issue = await openSourceReviewIssue(newOnes, { owner, repo, token, runDate });
    console.log(`Found ${newOnes.length} new source(s). Opened: ${issue?.url}`);
  } else {
    console.log(`Found ${newOnes.length} new source(s), but GITHUB_REPOSITORY/GITHUB_TOKEN are not set -- skipped opening an issue.`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
