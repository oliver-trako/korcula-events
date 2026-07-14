const ALLOWED_FILES = new Set([
  "data/pending-events.json",
  "data/events.json",
  "data/source-check-report.json",
  "data/social-source-report.json",
  "data/poster-ocr-report.json"
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const prefix = "/review-data/";

    if (request.method !== "GET") {
      return jsonResponse({ error: "method not allowed" }, 405);
    }

    if (!url.pathname.startsWith(prefix)) {
      return jsonResponse({ error: "not found" }, 404);
    }

    const filePath = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!ALLOWED_FILES.has(filePath)) {
      return jsonResponse({ error: "review data file is not allowed" }, 404);
    }

    const ref = url.searchParams.get("ref") || "main";
    const githubUrl = new URL(`https://api.github.com/repos/oliver-trako/korcula-events/contents/site/${filePath}`);
    githubUrl.searchParams.set("ref", ref);

    const upstream = await fetch(githubUrl.toString(), {
      headers: {
        "accept": "application/vnd.github.raw",
        "user-agent": "korcula-events-review-data"
      }
    });

    if (!upstream.ok) {
      return jsonResponse({
        error: "github data fetch failed",
        status: upstream.status,
        statusText: upstream.statusText,
        filePath,
        ref
      }, upstream.status);
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
