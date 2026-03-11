function parseTimeMs(iso) {
  const ms = Date.parse(String(iso || ""));
  return Number.isFinite(ms) ? ms : null;
}

function isoDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pickItemDay(item) {
  return isoDay(item?.publishedAt) || isoDay(item?.updatedAt) || null;
}

function impactLevelFromScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "low";
  if (s >= 140) return "high";
  if (s >= 105) return "medium";
  return "low";
}

function defaultImpactArea(item) {
  const c = String(item?.category || "").toLowerCase();
  if (c.includes("model")) return "model";
  if (c.includes("tool")) return "tooling";
  if (c.includes("policy") || c.includes("safety")) return "policy";
  return "product";
}

function buildDedupGroupIndex(ingested) {
  const groups = Array.isArray(ingested?.dedup?.groups) ? ingested.dedup.groups : [];
  const map = new Map();
  for (const g of groups) {
    const key = String(g?.key || "");
    if (!key) continue;
    map.set(key, g);
  }
  return map;
}

function sortNewestFirst(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

module.exports = (() => {
  // Generated from real ingested/candidate data when present; otherwise render no digests.
  let ingested = null;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    ingested = require("./ingested.json");
  } catch {
    return [];
  }

  const items = Array.isArray(ingested?.items) ? ingested.items : [];
  const groupIndex = buildDedupGroupIndex(ingested);

  const canonicalOnly = items.filter((it) => {
    if (!it || !it.dedup) return true;
    return Boolean(it?.dedup?.isCanonical);
  });
  const byDay = new Map();

  for (const item of canonicalOnly) {
    const day = pickItemDay(item);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }

  const days = Array.from(byDay.keys()).sort().reverse().slice(0, 14);
  const digests = days.map((day) => {
    const dayItems = byDay.get(day) || [];
    const top = [...dayItems].sort((a, b) => (Number(b?.score) || -999) - (Number(a?.score) || -999)).slice(0, 16);
    return {
      date: day,
      title: "Daily candidates",
      summary: "Deterministic shortlist from ingested feeds. Not yet AI-summarized.",
      items: top.map((it) => ({
        title: it.title,
        url: it.url,
        snippet: it.snippet || "",
        sources: (() => {
          const key = String(it?.dedup?.key || "");
          const g = key && groupIndex.has(key) ? groupIndex.get(key) : null;
          const srcs = Array.isArray(g?.sources) ? g.sources : [];
          if (srcs.length) {
            return srcs.map((s) => ({ name: s.name || s.id, url: s.url || it.url }));
          }
          return it.sourceName ? [{ name: it.sourceName, url: it.sourceUrl || it.feedUrl || it.url }] : [];
        })(),
        impactArea: it?.classification?.impactArea || defaultImpactArea(it),
        impactLevel: it?.classification?.impactLevel || impactLevelFromScore(it?.score),
        tags: it?.classification?.tags || [],
        dedup: it?.dedup || null,
        score: it?.score ?? null
      }))
    };
  });

  return digests.sort(sortNewestFirst);
})();
