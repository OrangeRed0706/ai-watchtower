const { sha256Hex } = require("./normalize");

function safeLower(s) {
  return String(s || "").toLowerCase();
}

function parseTimeMs(iso) {
  const ms = Date.parse(String(iso || ""));
  return Number.isFinite(ms) ? ms : null;
}

function pickTimestampMs(item) {
  return parseTimeMs(item?.publishedAt) ?? parseTimeMs(item?.updatedAt) ?? null;
}

function isoDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pickDay(item) {
  return isoDay(item?.publishedAt) || isoDay(item?.updatedAt) || null;
}

function stableTitleKey(item) {
  const day = pickDay(item) || "unknown-day";
  const t = safeLower(item?.title || "").replace(/\s+/g, " ").trim();
  return `t:${sha256Hex(`${day}|${t}`)}`;
}

function dedupKeyForItem(item) {
  const url = String(item?.url || "").trim();
  if (url) return { key: `u:${sha256Hex(url)}`, basis: "url", value: url };

  const contentHash = String(item?.contentHash || "").trim();
  if (contentHash) return { key: `c:${contentHash}`, basis: "contentHash", value: contentHash };

  return { key: stableTitleKey(item), basis: "titleDay", value: null };
}

function compareItemsForCanonical(a, b) {
  const sa = Number(a?.score);
  const sb = Number(b?.score);
  if (Number.isFinite(sa) || Number.isFinite(sb)) {
    if (!Number.isFinite(sa)) return 1;
    if (!Number.isFinite(sb)) return -1;
    if (sb !== sa) return sb - sa;
  }

  const pa = Number(a?.sourcePriority);
  const pb = Number(b?.sourcePriority);
  if (Number.isFinite(pa) || Number.isFinite(pb)) {
    if (!Number.isFinite(pa)) return 1;
    if (!Number.isFinite(pb)) return -1;
    if (pb !== pa) return pb - pa;
  }

  const ta = pickTimestampMs(a) ?? 0;
  const tb = pickTimestampMs(b) ?? 0;
  if (tb !== ta) return tb - ta;

  return String(a?.title || "").localeCompare(String(b?.title || ""));
}

function dedupeItems(items) {
  const groupsMap = new Map(); // key -> { key, basis, value, members: [] }

  for (const item of items) {
    const { key, basis, value } = dedupKeyForItem(item);
    if (!groupsMap.has(key)) groupsMap.set(key, { key, basis, value, members: [] });
    groupsMap.get(key).members.push(item);
  }

  const groups = [];
  const itemsOut = [];

  for (const g of groupsMap.values()) {
    const membersSorted = [...g.members].sort(compareItemsForCanonical);
    const canonical = membersSorted[0] || null;

    const sourceSet = new Map(); // id -> {id,name,url}
    for (const it of membersSorted) {
      const sid = String(it?.sourceId || "").trim();
      if (!sid) continue;
      if (!sourceSet.has(sid)) {
        sourceSet.set(sid, {
          id: sid,
          name: it?.sourceName || sid,
          url: it?.sourceUrl || it?.feedUrl || null
        });
      }
    }

    const groupObj = {
      key: g.key,
      basis: g.basis,
      value: g.value,
      memberCount: membersSorted.length,
      canonicalFingerprint: canonical?.fingerprint || null,
      memberFingerprints: membersSorted.map((it) => it?.fingerprint || null).filter(Boolean),
      sources: Array.from(sourceSet.values()).sort((a, b) => a.name.localeCompare(b.name)),
      canonical: canonical
        ? {
            title: canonical.title || null,
            url: canonical.url || null,
            publishedAt: canonical.publishedAt || null,
            score: canonical.score ?? null
          }
        : null
    };

    groups.push(groupObj);

    for (const it of membersSorted) {
      itemsOut.push({
        ...it,
        dedup: {
          version: 1,
          key: g.key,
          basis: g.basis,
          groupSize: membersSorted.length,
          isCanonical: canonical?.fingerprint && it?.fingerprint === canonical.fingerprint
        }
      });
    }
  }

  const groupStats = {
    version: 1,
    groups: groups.length,
    itemsIn: items.length,
    itemsOut: itemsOut.length,
    duplicateItems: itemsOut.filter((it) => it?.dedup && it.dedup.groupSize > 1 && !it.dedup.isCanonical).length
  };

  return {
    version: 1,
    stats: groupStats,
    groups: groups.sort((a, b) => {
      const as = Number(a?.canonical?.score);
      const bs = Number(b?.canonical?.score);
      if (Number.isFinite(as) || Number.isFinite(bs)) {
        if (!Number.isFinite(as)) return 1;
        if (!Number.isFinite(bs)) return -1;
        if (bs !== as) return bs - as;
      }
      return String(b?.key || "").localeCompare(String(a?.key || ""));
    }),
    items: itemsOut
  };
}

module.exports = {
  dedupeItems
};

