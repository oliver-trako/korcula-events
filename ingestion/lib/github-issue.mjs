/**
 * Opens one GitHub Issue per run summarizing every candidate that needs a human decision --
 * replacing the old pattern of silently force-pushing onto a single forgotten PR. Durable,
 * shows up in GitHub's own notification email, no dependency on a chat session existing.
 */

export class GitHubApiError extends Error {
  constructor(reason) {
    super(`GitHub API call failed: ${reason}`);
    this.name = "GitHubApiError";
    this.reason = reason;
  }
}

function formatCandidate(item) {
  const { candidate, verifierResult, blockingReasons, duplicateMatches, sourceUrl } = item;
  const title = `${candidate.hr} / ${candidate.en}`;
  const lines = [
    `### ${title}`,
    `- **Date:** ${candidate.date}${candidate.endDate ? ` to ${candidate.endDate}` : ""}${candidate.time ? ` at ${candidate.time}` : ""}`,
    `- **Town / venue:** ${candidate.town} / ${candidate.venue}`,
    `- **Categories:** ${(candidate.cats || []).join(", ")}`,
    `- **Source:** ${sourceUrl}`,
    `- **Verifier confidence:** ${verifierResult.confidence}`
  ];
  if (verifierResult.concerns?.length) {
    lines.push(`- **Verifier concerns:** ${verifierResult.concerns.join("; ")}`);
  }
  if (blockingReasons?.length) {
    lines.push(`- **Blocking reasons:** ${blockingReasons.join(", ")}`);
  }
  if (duplicateMatches?.length) {
    lines.push(`- **Possible duplicate of:** ${duplicateMatches.map((m) => `${m.eventId} (score ${m.score})`).join(", ")}`);
  }
  if (candidate.desc?.en) {
    lines.push(`- **Description:** ${candidate.desc.en}`);
  }
  return lines.join("\n");
}

export function buildIssueBody(reviewItems, { runDate }) {
  const header = [
    `Automated event ingestion run — ${runDate}.`,
    "",
    `**${reviewItems.length} candidate(s) need a decision.** For each: add it to \`site/data/events.json\` if it's good (or ask me to), then close this issue.`,
    ""
  ];
  return header.join("\n") + reviewItems.map(formatCandidate).join("\n\n---\n\n");
}

/**
 * @param {object[]} reviewItems - [{ candidate, verifierResult, blockingReasons, duplicateMatches, sourceUrl }]
 * @param {object} options - { owner, repo, token, runDate, fetchImpl }
 */
export async function openReviewIssue(reviewItems, { owner, repo, token, runDate, fetchImpl = fetch } = {}) {
  if (!reviewItems.length) return null;
  if (!owner || !repo || !token) throw new GitHubApiError("missing owner/repo/token");

  const body = buildIssueBody(reviewItems, { runDate });
  const title = `Event review: ${reviewItems.length} candidate${reviewItems.length === 1 ? "" : "s"} — ${runDate}`;

  const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ title, body, labels: ["event-review"], assignees: [owner] })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new GitHubApiError(`http-error:${response.status}:${text.slice(0, 300)}`);
  }
  const issue = await response.json();
  return { number: issue.number, url: issue.html_url };
}

/**
 * @param {object[]} sourceCandidates - [{ id, name, type, url, notes }]
 */
export async function openSourceReviewIssue(sourceCandidates, { owner, repo, token, runDate, fetchImpl = fetch } = {}) {
  if (!sourceCandidates.length) return null;
  if (!owner || !repo || !token) throw new GitHubApiError("missing owner/repo/token");

  const lines = [
    `Automated source discovery run — ${runDate}.`,
    "",
    `**${sourceCandidates.length} new source(s) found**, not yet in \`ingestion/data/sources.json\`. Approve by copying an entry into that file; reject by leaving it here.`,
    ""
  ];
  for (const s of sourceCandidates) {
    lines.push(`### ${s.name}`, `- **URL:** ${s.url}`, `- **Suggested type:** ${s.type}`, s.notes ? `- **Notes:** ${s.notes}` : "", "");
  }

  const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      title: `Source discovery: ${sourceCandidates.length} candidate(s) — ${runDate}`,
      body: lines.join("\n"),
      labels: ["source-review"],
      assignees: [owner]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new GitHubApiError(`http-error:${response.status}:${text.slice(0, 300)}`);
  }
  const issue = await response.json();
  return { number: issue.number, url: issue.html_url };
}
