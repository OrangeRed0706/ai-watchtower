module.exports = (() => {
  let ingested = null;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    ingested = require("./ingested.json");
  } catch {
    return { available: false, groups: [], stats: null, generatedAt: null };
  }

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
})();

