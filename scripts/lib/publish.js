function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

function sortCandidates(a, b) {
  const sa = toNumber(a?.score) ?? -999;
  const sb = toNumber(b?.score) ?? -999;
  if (sb !== sa) return sb - sa;

  const ta = parseTimeMs(a?.publishedAt) ?? parseTimeMs(a?.updatedAt) ?? 0;
  const tb = parseTimeMs(b?.publishedAt) ?? parseTimeMs(b?.updatedAt) ?? 0;
  if (tb !== ta) return tb - ta;

  return String(a?.title || "").localeCompare(String(b?.title || ""));
}

function enrichWithDedupGroup(item, groupIndex) {
  const key = String(item?.dedup?.key || "");
  if (!key || !groupIndex.has(key)) return item;
  const g = groupIndex.get(key);
  return {
    ...item,
    dedupGroup: {
      key: g.key,
      basis: g.basis,
      memberCount: g.memberCount,
      sources: g.sources || []
    }
  };
}

function buildCandidates(ingested) {
  if (!ingested) return { available: false, items: [], totalItems: 0, topCount: 0 };

  const items = Array.isArray(ingested?.items) ? ingested.items : [];
  const groupIndex = buildDedupGroupIndex(ingested);

  const canonicalOnly = items.filter((it) => {
    if (!it || !it.dedup) return true;
    return Boolean(it?.dedup?.isCanonical);
  });

  const baseItems = canonicalOnly.length ? canonicalOnly : items;
  const enriched = baseItems.map((it) => enrichWithDedupGroup(it, groupIndex));
  const sorted = [...enriched].sort(sortCandidates);
  const top = sorted.slice(0, 50);

  return {
    available: true,
    generatedAt: ingested?.generatedAt || null,
    run: ingested?.run || null,
    scoring: ingested?.scoring || null,
    classification: ingested?.classification || null,
    dedup: ingested?.dedup || null,
    totalItems: items.length,
    uniqueItems: canonicalOnly.length || items.length,
    topCount: top.length,
    items: top
  };
}

function buildDigests(ingested) {
  if (!ingested) return [];

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
    const top = [...dayItems]
      .sort((a, b) => (Number(b?.score) || -999) - (Number(a?.score) || -999))
      .slice(0, 16);

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

  return digests.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function buildDedupGroups(ingested) {
  if (!ingested) return { available: false, groups: [], stats: null, generatedAt: null };

  const items = Array.isArray(ingested?.items) ? ingested.items : [];
  const groups = Array.isArray(ingested?.dedup?.groups) ? ingested.dedup.groups : [];

  const membersByKey = new Map();
  for (const it of items) {
    const key = String(it?.dedup?.key || "");
    if (!key) continue;
    if (!membersByKey.has(key)) membersByKey.set(key, []);
    membersByKey.get(key).push({
      fingerprint: it?.fingerprint || null,
      title: it?.title || null,
      url: it?.url || null,
      sourceId: it?.sourceId || null,
      sourceName: it?.sourceName || null,
      score: it?.score ?? null,
      isCanonical: Boolean(it?.dedup?.isCanonical)
    });
  }

  const groupsOut = groups.map((g) => {
    const key = String(g?.key || "");
    const members = membersByKey.get(key) || [];
    const canonical = members.find((m) => m.isCanonical) || null;
    const sortedMembers = [...members].sort((a, b) => {
      if (a.isCanonical !== b.isCanonical) return a.isCanonical ? -1 : 1;
      const sa = Number(a?.score);
      const sb = Number(b?.score);
      if (Number.isFinite(sa) || Number.isFinite(sb)) {
        if (!Number.isFinite(sa)) return 1;
        if (!Number.isFinite(sb)) return -1;
        if (sb !== sa) return sb - sa;
      }
      return String(a?.sourceName || "").localeCompare(String(b?.sourceName || ""));
    });

    return {
      key,
      basis: g?.basis || null,
      value: g?.value || null,
      memberCount: g?.memberCount || sortedMembers.length,
      sources: g?.sources || [],
      canonical: canonical || g?.canonical || null,
      members: sortedMembers
    };
  });

  return {
    available: true,
    generatedAt: ingested?.generatedAt || null,
    stats: ingested?.dedup?.stats || null,
    groups: groupsOut
  };
}

module.exports = {
  buildCandidates,
  buildDigests,
  buildDedupGroups
};

