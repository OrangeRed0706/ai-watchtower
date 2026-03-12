import type { Classification } from "../contracts/artifacts";

function safeLower(input: string | null | undefined): string {
  return String(input || "").toLowerCase();
}

function includesAny(haystack: string | null | undefined, needles: string[]): boolean {
  const lower = safeLower(haystack);
  return needles.some((needle) => lower.includes(String(needle).toLowerCase()));
}

function testAny(haystack: string | null | undefined, regexes: RegExp[]): boolean {
  const value = String(haystack || "");
  return regexes.some((regex) => regex.test(value));
}

function inferImpactArea(input: {
  category?: string | null;
  sourceType?: string | null;
  tags: Set<string>;
}): Classification["impactArea"] {
  const category = safeLower(input.category);
  const sourceType = safeLower(input.sourceType);

  if (input.tags.has("security")) return "security";
  if (input.tags.has("pricing")) return "product";
  if (input.tags.has("policy")) return "policy";
  if (category.includes("model")) return "model";
  if (category.includes("tool") || category.includes("framework") || category.includes("sdk")) {
    return "tooling";
  }
  if (sourceType.includes("release") || sourceType.includes("changelog")) return "tooling";
  return "product";
}

function impactLevelFromSignals(input: {
  score?: number | null;
  tags: Set<string>;
  reasonCount: number;
}): Classification["impactLevel"] {
  if (input.tags.has("security") || input.tags.has("pricing") || input.tags.has("breaking")) {
    return "high";
  }
  if (typeof input.score === "number") {
    if (input.score >= 140) return "high";
    if (input.score >= 105) return "medium";
    return "low";
  }
  if (input.reasonCount > 0) return "medium";
  return "low";
}

export function classifyItem(item: {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
  score?: number | null;
  category?: string | null;
  sourceType?: string | null;
}): Classification {
  const title = String(item.title || "");
  const url = String(item.url || "");
  const snippet = String(item.snippet || "");
  const tags = new Set<string>();
  const reasons: Classification["reasons"] = [];

  if (
    testAny(title, [/\bcve-\d{4}-\d+\b/i]) ||
    includesAny(title, ["vulnerability", "security", "secret scanning"]) ||
    includesAny(snippet, ["security", "secret scanning", "vulnerability"])
  ) {
    tags.add("security");
    reasons.push({ key: "title:security", note: "security/vulnerability keyword" });
  }
  if (includesAny(url, ["/security", "security."])) {
    tags.add("security");
    reasons.push({ key: "url:security", note: "security path/host hint" });
  }
  if (
    testAny(title, [/\brelease notes?\b/i, /\breleased\b/i, /\brelease\b/i]) ||
    includesAny(url, ["/releases", "releases."])
  ) {
    tags.add("release");
    reasons.push({ key: "release:hint", note: "release title/url hint" });
  }
  if (includesAny(title, ["changelog"]) || includesAny(url, ["/changelog", "changelog"])) {
    tags.add("changelog");
    reasons.push({ key: "changelog:hint", note: "changelog title/url hint" });
  }
  if (testAny(title, [/\bdeprecat/i, /\bmigration\b/i, /\bbreaking\b/i])) {
    tags.add("breaking");
    reasons.push({ key: "title:breaking", note: "breaking/deprecation/migration hint" });
  }
  if (
    testAny(title, [/\bpricing\b/i, /\bcost\b/i, /\brate limit\b/i, /\bquota\b/i]) ||
    includesAny(url, ["/pricing", "pricing"])
  ) {
    tags.add("pricing");
    reasons.push({ key: "pricing:hint", note: "pricing/cost hint" });
  }
  if (
    testAny(title, [/\bpolicy\b/i, /\bterms\b/i, /\bcompliance\b/i]) ||
    includesAny(snippet, ["policy", "terms", "compliance"])
  ) {
    tags.add("policy");
    reasons.push({ key: "policy:hint", note: "policy/terms/compliance hint" });
  }
  if (testAny(title, [/\bsdk\b/i, /\bapi\b/i, /\bclient library\b/i])) {
    tags.add("sdk");
    reasons.push({ key: "title:sdk", note: "sdk/api hint" });
  }
  if (testAny(title, [/\bbenchmark\b/i, /\beval\b/i, /\bevaluation\b/i])) {
    tags.add("evaluation");
    reasons.push({ key: "title:evaluation", note: "eval/benchmark hint" });
  }
  if (testAny(title, [/\bwebinar\b/i, /\bconference\b/i, /\bmeetup\b/i, /\bpodcast\b/i])) {
    tags.add("event");
    reasons.push({ key: "title:event", note: "event/webinar/podcast hint" });
  }

  return {
    version: 1,
    impactArea: inferImpactArea({ category: item.category, sourceType: item.sourceType, tags }),
    impactLevel: impactLevelFromSignals({ score: item.score, tags, reasonCount: reasons.length }),
    tags: Array.from(tags).sort((left, right) => left.localeCompare(right)),
    reasons
  };
}
