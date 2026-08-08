import { createHash } from "node:crypto";
import dns from "node:dns";
import https from "node:https";

export class RetrievalBlockedError extends Error {
  constructor(reason) {
    super(`Safe retrieval blocked: ${reason}`);
    this.name = "RetrievalBlockedError";
    this.reason = reason;
  }
}

function ipv4Octets(ip) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

/**
 * SSRF guard: refuse any address a connector should never be allowed to reach even if DNS
 * for an allowlisted hostname were poisoned or rebound — loopback, private, link-local,
 * carrier-grade NAT, multicast and reserved ranges for both IPv4 and IPv6.
 */
export function isPrivateOrReservedIp(ip, family) {
  if (family === 4) {
    const octets = ipv4Octets(ip);
    if (!octets) return true;
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
    return false;
  }
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff")) return true;
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (mapped) return isPrivateOrReservedIp(mapped[1], 4);
  return false;
}

/**
 * Resolves + validates a hostname and returns the *specific* safe addresses found, rather
 * than just a pass/fail. The caller must pin the actual connection to one of these addresses
 * (see `pinnedLookup` below) — checking DNS here and then letting the real request re-resolve
 * independently is exactly the TOCTOU/DNS-rebinding gap this function exists to prevent.
 */
async function resolveSafeHost(hostname, { allowedHosts, dnsLookup }) {
  if (!allowedHosts.has(hostname)) throw new RetrievalBlockedError(`host-not-allowlisted:${hostname}`);
  const addresses = await dnsLookup(hostname, { all: true });
  if (!addresses.length) throw new RetrievalBlockedError(`dns-resolution-failed:${hostname}`);
  for (const { address, family } of addresses) {
    if (isPrivateOrReservedIp(address, family)) throw new RetrievalBlockedError(`resolved-address-not-public:${hostname}`);
  }
  return addresses;
}

/**
 * A `lookup` function (matching `dns.lookup`'s callback signature) that never resolves DNS
 * itself — it only ever hands back the exact addresses `resolveSafeHost` already validated.
 * Passed straight into `https.request`'s `lookup` option, which `net.connect` honors, so the
 * TCP connection is guaranteed to land on a pre-validated address, closing the rebind window.
 */
function pinnedLookup(validatedAddresses) {
  return (hostname, options, callback) => {
    if (typeof options === "function") { callback = options; options = {}; }
    if (options?.all) {
      callback(null, validatedAddresses.map((a) => ({ address: a.address, family: a.family })));
      return;
    }
    const first = validatedAddresses[0];
    callback(null, first.address, first.family);
  };
}

/**
 * Read a response body while enforcing a byte ceiling, destroying the stream as soon as it's
 * exceeded rather than buffering an unbounded payload first.
 */
function readBounded(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    res.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        reject(new RetrievalBlockedError("payload-too-large"));
        return;
      }
      chunks.push(chunk);
    });
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);
  });
}

function contentTypeMatches(header, accepted) {
  const declared = (header || "").split(";")[0].trim().toLowerCase();
  return accepted.some((type) => type.toLowerCase() === declared);
}

/**
 * The safe-retrieval client every ingestion adapter's `retrieve` step is built to require.
 * Enforces HTTPS, a host allowlist re-checked against live DNS resolution (SSRF), a DNS
 * result *pinned* to the actual TCP connection (see `pinnedLookup` — this is the fix for the
 * DNS-rebinding gap in the original version of this module, where the validated address was
 * discarded and the real connection re-resolved DNS independently), redirect revalidation at
 * every hop, a request timeout, an accepted content-type allowlist, and a byte ceiling — then
 * returns a content-hashed, evidence-ready result.
 */
export function createSafeRetrievalClient({ dnsLookup = dns.promises.lookup, requestImpl = https.request } = {}) {
  function performRequest(url, { headers, lookup, timeoutMs }) {
    return new Promise((resolve, reject) => {
      const req = requestImpl(url, { method: "GET", headers, lookup }, (res) => resolve(res));
      req.on("error", reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new RetrievalBlockedError("timeout"));
      });
      req.end();
    });
  }

  async function fetchResource(url, retrievalConfig, options = {}) {
    const { allowedHosts, timeoutMs, maxBytes, maxRedirects, acceptedContentTypes } = retrievalConfig;
    const hostSet = new Set(allowedHosts);
    let currentUrl = new URL(url);
    if (currentUrl.protocol !== "https:") throw new RetrievalBlockedError("non-https-url");

    for (let redirectCount = 0; ; redirectCount += 1) {
      const validatedAddresses = await resolveSafeHost(currentUrl.hostname, { allowedHosts: hostSet, dnsLookup });
      const lookup = pinnedLookup(validatedAddresses);

      const res = await performRequest(currentUrl.toString(), { headers: options.headers, lookup, timeoutMs });

      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume(); // discard body, release the socket
        if (redirectCount >= maxRedirects) throw new RetrievalBlockedError("too-many-redirects");
        const location = res.headers.location;
        if (!location) throw new RetrievalBlockedError("redirect-without-location");
        currentUrl = new URL(location, currentUrl);
        if (currentUrl.protocol !== "https:") throw new RetrievalBlockedError("redirect-to-non-https");
        continue;
      }

      if (res.statusCode === 304) {
        res.resume();
        return { status: 304, url: currentUrl.toString(), notModified: true };
      }
      if (res.statusCode >= 400) {
        res.resume();
        throw new RetrievalBlockedError(`http-error:${res.statusCode}`);
      }

      const contentType = res.headers["content-type"] || "";
      if (!contentTypeMatches(contentType, acceptedContentTypes)) {
        res.resume();
        throw new RetrievalBlockedError(`content-type-not-accepted:${contentType || "missing"}`);
      }

      const bytes = await readBounded(res, maxBytes);
      // `body` decodes as UTF-8 text for HTML/feed callers. That decode is lossy for binary
      // content, so binary consumers must use `rawBytes`, never `body`.
      const body = bytes.toString("utf8");
      const contentHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      return {
        status: res.statusCode,
        url: currentUrl.toString(),
        contentType,
        body,
        rawBytes: bytes,
        contentHash,
        bytes: bytes.byteLength,
        etag: res.headers.etag || null,
        lastModified: res.headers["last-modified"] || null
      };
    }
  }

  return { fetchResource };
}
