import type { NormalizedItem, ScoredItem } from "../contracts/artifacts";
import { sha256Hex } from "./normalize";

function parseTimeMs(input: string | null | undefined): number | null {
  const ms = Date.parse(String(input || ""));
  return Number.isFinite(ms) ? ms : null;
}

function isoDay(input: string | null | undefined): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function stableTitleKey(item: NormalizedItem): string {
  const day = isoDay(item.publishedAt) || isoDay(item.updatedAt) || "unknown-day";
  const title = String(item.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `t:${sha256Hex(`${day}|${title}`)}`;
}

export function dedupKeyForItem(item: { url?: string | null; contentHash?: string | null; title?: string | null; publishedAt?: string | null; updatedAt?: string | null }): {
  key: string;
  basis: "url" | "contentHash" | "titleDay";
  value: string | null;
} {
  const url = String(item.url || "").trim();
  if (url) return { key: `u:${sha256Hex(url)}`, basis: "url", value: url };
  const contentHash = String(item.contentHash || "").trim();
  if (contentHash) return { key: `c:${contentHash}`, basis: "contentHash", value: contentHash };
  return { key: stableTitleKey(item as NormalizedItem), basis: "titleDay", value: null };
}

function compareCanonical(left: Pick<ScoredItem, "score" | "sourcePriority" | "publishedAt" | "updatedAt" | "title">, right: Pick<ScoredItem, "score" | "sourcePriority" | "publishedAt" | "updatedAt" | "title">): number {
  if (right.score !== left.score) return right.score - left.score;
  const leftPriority = left.sourcePriority ?? -1;
  const rightPriority = right.sourcePriority ?? -1;
  if (rightPriority !== leftPriority) return rightPriority - leftPriority;
  const leftTime = parseTimeMs(left.publishedAt) ?? parseTimeMs(left.updatedAt) ?? 0;
  const rightTime = parseTimeMs(right.publishedAt) ?? parseTimeMs(right.updatedAt) ?? 0;
  if (rightTime !== leftTime) return rightTime - leftTime;
  return String(left.title || "").localeCompare(String(right.title || ""));
}

export function dedupeItems(items: Omit<ScoredItem, "dedup">[]): {
  groups: Array<{
    key: string;
    basis: "url" | "contentHash" | "titleDay";
    value: string | null;
    members: ScoredItem[];
  }>;
  stats: {
    groups: number;
    itemsIn: number;
    itemsOut: number;
    duplicateItems: number;
  };
  items: ScoredItem[];
} {
  const groups = new Map<string, { key: string; basis: "url" | "contentHash" | "titleDay"; value: string | null; members: Omit<ScoredItem, "dedup">[] }>();

  for (const item of items) {
    const key = dedupKeyForItem(item);
    const existing = groups.get(key.key);
    if (existing) {
      existing.members.push(item);
    } else {
      groups.set(key.key, { ...key, members: [item] });
    }
  }

  const materializedGroups: Array<{ key: string; basis: "url" | "contentHash" | "titleDay"; value: string | null; members: ScoredItem[] }> = [];
  const materializedItems: ScoredItem[] = [];

  for (const group of groups.values()) {
    const sorted = [...group.members].sort(compareCanonical);
    const canonicalFingerprint = sorted[0]?.fingerprint;
    const members = sorted.map((item) => ({
      ...item,
      dedup: {
        version: 1,
        key: group.key,
        basis: group.basis,
        groupSize: sorted.length,
        isCanonical: item.fingerprint === canonicalFingerprint
      }
    }));
    materializedGroups.push({ key: group.key, basis: group.basis, value: group.value, members });
    materializedItems.push(...members);
  }

  return {
    groups: materializedGroups,
    stats: {
      groups: materializedGroups.length,
      itemsIn: items.length,
      itemsOut: materializedItems.length,
      duplicateItems: materializedItems.filter((item) => !item.dedup.isCanonical).length
    },
    items: materializedItems
  };
}
