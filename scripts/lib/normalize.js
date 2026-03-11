const crypto = require("node:crypto");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input), "utf8").digest("hex");
}

function stripHtml(input) {
  const s = String(input || "");
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function collapseWhitespace(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(titleRaw) {
  return collapseWhitespace(titleRaw);
}

function normalizeSnippet(snippetRaw, { maxLen = 280 } = {}) {
  const text = collapseWhitespace(stripHtml(snippetRaw));
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS_EXACT = new Set([
  "fbclid",
  "gclid",
  "wbraid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "ref",
  "ref_src",
  "source",
  "s",
  "cmpid",
  "igshid"
]);

function canonicalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw;

  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  u.hash = "";
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  for (const [key] of Array.from(u.searchParams.entries())) {
    const lower = key.toLowerCase();
    const isPrefixed = TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p));
    if (isPrefixed || TRACKING_PARAMS_EXACT.has(lower)) u.searchParams.delete(key);
  }

  // Sort remaining query params for stable canonicalization.
  const entries = Array.from(u.searchParams.entries()).sort(([a], [b]) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const qs = new URLSearchParams(entries).toString();
  u.search = qs ? `?${qs}` : "";

  // Normalize common trailing slash inconsistencies (keep root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

module.exports = {
  canonicalizeUrl,
  normalizeSnippet,
  normalizeTimestamp,
  normalizeTitle,
  sha256Hex
};
