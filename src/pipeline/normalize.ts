import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function stripHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function collapseWhitespace(input: string): string {
  return String(input || "").replace(/\s+/g, " ").trim();
}

export function normalizeTitle(titleRaw: string): string {
  return collapseWhitespace(titleRaw);
}

export function normalizeSnippet(snippetRaw: string, options: { maxLen?: number } = {}): string {
  const maxLen = options.maxLen ?? 280;
  const text = collapseWhitespace(stripHtml(String(snippetRaw || "")));
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

export function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

export function canonicalizeUrl(input: string | null | undefined): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  for (const [key] of Array.from(url.searchParams.entries())) {
    const lower = key.toLowerCase();
    const prefixed = TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
    if (prefixed || TRACKING_PARAMS_EXACT.has(lower)) {
      url.searchParams.delete(key);
    }
  }

  const entries = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const queryString = new URLSearchParams(entries).toString();
  url.search = queryString ? `?${queryString}` : "";

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
