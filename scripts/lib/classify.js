function safeLower(s) {
  return String(s || "").toLowerCase();
}

function includesAny(haystack, needles) {
  const h = safeLower(haystack);
  return needles.some((n) => h.includes(String(n).toLowerCase()));
}

function testAny(haystack, regexes) {
  const h = String(haystack || "");
  return regexes.some((re) => re.test(h));
}

function inferImpactArea({ category, sourceType, tags }) {
  const c = safeLower(category);
  const st = safeLower(sourceType);

  if (tags.has("security")) return "security";
  if (tags.has("pricing")) return "product";
  if (tags.has("policy")) return "policy";

  if (c.includes("model")) return "model";
  if (c.includes("tool") || c.includes("framework") || c.includes("sdk")) return "tooling";
  if (st.includes("release") || st.includes("changelog")) return "tooling";

  return "product";
}

function impactLevelFromSignals({ score, tags, reasons }) {
  const s = Number(score);

  if (tags.has("security")) return "high";
  if (tags.has("pricing")) return "high";
  if (tags.has("breaking")) return "high";

  if (Number.isFinite(s)) {
    if (s >= 140) return "high";
    if (s >= 105) return "medium";
    return "low";
  }

  // Fallback: if we have strong-ish reasons, default to medium.
  if (reasons.length) return "medium";
  return "low";
}

function classifyItem(item) {
  const title = String(item?.title || "");
  const url = String(item?.url || "");
  const snippet = String(item?.snippet || "");

  const reasons = [];
  const tags = new Set();

  if (testAny(title, [/\bcve-\d{4}-\d+\b/i]) || includesAny(title, ["vulnerability", "security"])) {
    tags.add("security");
    reasons.push({ key: "title:security", note: "security/vulnerability keyword" });
  }

  if (includesAny(url, ["/security", "security."])) {
    tags.add("security");
    reasons.push({ key: "url:security", note: "security path/host hint" });
  }

  if (testAny(title, [/\brelease notes?\b/i, /\breleased\b/i, /\brelease\b/i]) || includesAny(url, ["/releases", "releases."])) {
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

  if (testAny(title, [/\bpricing\b/i, /\bcost\b/i, /\brate limit\b/i, /\bquota\b/i]) || includesAny(url, ["/pricing", "pricing"])) {
    tags.add("pricing");
    reasons.push({ key: "pricing:hint", note: "pricing/cost hint" });
  }

  if (testAny(title, [/\bpolicy\b/i, /\bterms\b/i, /\bcompliance\b/i]) || includesAny(snippet, ["policy", "terms", "compliance"])) {
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

  const impactArea = inferImpactArea({
    category: item?.category,
    sourceType: item?.sourceType,
    tags
  });
  const impactLevel = impactLevelFromSignals({ score: item?.score, tags, reasons });

  const tagList = Array.from(tags).sort((a, b) => a.localeCompare(b));

  return {
    version: 1,
    impactArea,
    impactLevel,
    tags: tagList,
    reasons
  };
}

module.exports = {
  classifyItem
};

