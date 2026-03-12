const candidates = require("./candidates");
const dedupGroups = require("./dedupGroups");
const digests = require("./digests");
const ingested = require("./ingested");
const sources = require("./sources");

function sortNewestFirst(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

function countImpact(items) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const item of Array.isArray(items) ? items : []) {
    const level = String(item?.impactLevel || item?.classification?.impactLevel || "").toLowerCase();
    if (level === "high" || level === "medium" || level === "low") counts[level] += 1;
  }
  return counts;
}

function getSourceHealthSummary() {
  const runSources = Array.isArray(ingested?.sources) ? ingested.sources : [];
  const configured = runSources.length || sources.length || 0;
  const ok = runSources.filter((source) => source?.lastFetch?.ok).length;
  const errored = runSources.filter((source) => source?.lastFetch && source.lastFetch.ok === false).length;

  return {
    configured,
    ok,
    errored,
    hasRuntimeData: runSources.length > 0
  };
}

const allDigests = [...digests].sort(sortNewestFirst);
const latestDigest = allDigests[0] || null;
const latestCandidateItems = Array.isArray(candidates?.items) ? candidates.items : [];
const signalItems =
  latestDigest && Array.isArray(latestDigest.items) && latestDigest.items.length
    ? latestDigest.items
    : latestCandidateItems;

module.exports = {
  latestDigest,
  allDigests,
  signalItems,
  impactSummary: countImpact(signalItems),
  sourceHealth: getSourceHealthSummary(),
  snapshot: {
    digests: allDigests.length,
    uniqueCandidates: Number(candidates?.uniqueItems) || 0,
    totalCandidates: Number(candidates?.totalItems) || 0,
    groups: Number(dedupGroups?.stats?.groups) || 0,
    duplicateItems: Number(dedupGroups?.stats?.duplicateItems) || 0,
    latestRunAt: ingested?.generatedAt || candidates?.generatedAt || null,
    publishedDate: latestDigest?.date || null
  }
};
