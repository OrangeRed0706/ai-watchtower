import Ajv from "ajv";

import {
  candidateArtifactSchema,
  normalizedSnapshotSchema,
  type ArtifactBuildResult,
  type DedupGroupArtifact,
  type DigestArtifact,
  type NormalizedSnapshot,
  type ScoredItem
} from "../contracts/artifacts";
import { classifyItem } from "./classify";
import { dedupeItems } from "./dedup";
import { sha256Hex } from "./normalize";
import { scoreItem } from "./scoring";

function assertNever(_value: never): never {
  throw new Error("Unexpected value");
}

function toIsoDayInTimezone(input: string | null, timezone: string): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function dedupeGroupSources(group: { members: ScoredItem[] }): Array<{ id: string; name: string; url: string | null }> {
  const sources = new Map<string, { id: string; name: string; url: string | null }>();
  for (const member of group.members) {
    if (!sources.has(member.sourceId)) {
      sources.set(member.sourceId, {
        id: member.sourceId,
        name: member.sourceName,
        url: member.sourceUrl
      });
    }
  }
  return Array.from(sources.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function compareCandidates(left: ScoredItem, right: ScoredItem): number {
  if (right.score !== left.score) return right.score - left.score;
  return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
}

function applySourceDiversity(items: ScoredItem[], maxPerSource = 4): ScoredItem[] {
  const counts = new Map<string, number>();
  const result: ScoredItem[] = [];
  for (const item of items) {
    const count = counts.get(item.sourceId) ?? 0;
    if (count >= maxPerSource) continue;
    counts.set(item.sourceId, count + 1);
    result.push(item);
  }
  return result;
}

function buildDigests(items: ScoredItem[], timezone: string): DigestArtifact[] {
  const grouped = new Map<string, ScoredItem[]>();
  for (const item of items) {
    const day = toIsoDayInTimezone(item.publishedAt || item.updatedAt, timezone);
    if (!day) continue;
    const bucket = grouped.get(day) ?? [];
    bucket.push(item);
    grouped.set(day, bucket);
  }

  return Array.from(grouped.keys())
    .sort((left, right) => right.localeCompare(left))
    .slice(0, 14)
    .map((day) => {
      const ranked = applySourceDiversity(
        [...(grouped.get(day) ?? [])].sort(compareCandidates),
        3
      ).slice(0, 16);

      return {
        date: day,
        title: "Daily briefing",
        summary: "Deterministic daily briefing built from ranked, deduplicated intelligence signals.",
        items: ranked.map((item) => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          impactArea: item.classification.impactArea,
          impactLevel: item.classification.impactLevel,
          tags: item.classification.tags,
          score: item.score,
          sources: [{ name: item.sourceName, url: item.sourceUrl }],
          dedup: item.dedup
        }))
      };
    });
}

function buildDedupGroups(groups: Array<{ key: string; basis: "url" | "contentHash" | "titleDay"; value: string | null; members: ScoredItem[] }>): DedupGroupArtifact[] {
  return groups.map((group) => {
    const canonical = group.members.find((member) => member.dedup.isCanonical);
    if (!canonical) {
      assertNever(undefined as never);
    }
    return {
      key: group.key,
      basis: group.basis,
      value: group.value,
      memberCount: group.members.length,
      sources: dedupeGroupSources(group),
      canonical: {
        fingerprint: canonical.fingerprint,
        title: canonical.title,
        url: canonical.url,
        publishedAt: canonical.publishedAt,
        score: canonical.score
      },
      members: group.members.map((member) => ({
        fingerprint: member.fingerprint,
        title: member.title,
        url: member.url,
        sourceId: member.sourceId,
        sourceName: member.sourceName,
        score: member.score,
        isCanonical: member.dedup.isCanonical
      }))
    };
  });
}

export function buildArtifactSet(
  input: NormalizedSnapshot,
  options: { generatedAt?: string; timezone?: string; normalizedFile?: string } = {}
): ArtifactBuildResult {
  const snapshot = normalizedSnapshotSchema.parse(input);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const timezone = options.timezone ?? snapshot.window.timezone;

  const scored = snapshot.items.map((item) => {
    const scoredItem = scoreItem(item, { nowIso: generatedAt });
    const classification = classifyItem({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      score: scoredItem.score,
      category: item.category,
      sourceType: item.sourceType
    });

    return {
      ...item,
      score: scoredItem.score,
      scoreVersion: 1,
      scoreAgeHours: scoredItem.ageHours,
      scoreReasons: scoredItem.reasons,
      classification
    };
  });

  const deduped = dedupeItems(scored);
  const canonicalItems = deduped.items.filter((item) => item.dedup.isCanonical).sort(compareCandidates);
  const candidateItems = applySourceDiversity(canonicalItems, 4).slice(0, 50);

  const candidates = {
    schemaVersion: 1,
    generatedAt,
    runId: snapshot.runId,
    configHash: snapshot.configHash,
    totalItems: deduped.items.length,
    uniqueItems: canonicalItems.length,
    topCount: candidateItems.length,
    items: candidateItems
  };

  const digests = buildDigests(canonicalItems, timezone);
  const dedupGroups = {
    schemaVersion: 1,
    generatedAt,
    runId: snapshot.runId,
    configHash: snapshot.configHash,
    stats: deduped.stats,
    groups: buildDedupGroups(deduped.groups)
  };
  const sourceHealth = {
    schemaVersion: 1,
    generatedAt,
    runId: snapshot.runId,
    configHash: snapshot.configHash,
    sources: snapshot.sources,
    summary: {
      configured: snapshot.sources.length,
      ok: snapshot.sources.filter((source) => source.lastFetch?.ok).length,
      errored: snapshot.sources.filter((source) => source.lastFetch && !source.lastFetch.ok).length,
      hasRuntimeData: snapshot.sources.some((source) => Boolean(source.lastFetch))
    }
  };

  const ajv = new Ajv({ allErrors: true });
  const validateCandidates = ajv.compile(candidateArtifactSchema);
  const errors: string[] = [];
  if (!validateCandidates(candidates)) {
    errors.push(...(validateCandidates.errors ?? []).map((error) => `${error.instancePath} ${error.message}`.trim()));
  }

  const artifactsPayload = [
    { name: "items.json", value: snapshot, records: snapshot.items.length },
    { name: "candidates.json", value: candidates, records: candidates.items.length },
    { name: "digests.json", value: digests, records: digests.length },
    { name: "dedup-groups.json", value: dedupGroups, records: dedupGroups.groups.length },
    { name: "source-health.json", value: sourceHealth, records: sourceHealth.sources.length }
  ];

  const validation = {
    valid: errors.length === 0,
    errors
  };

  const manifest = {
    schemaVersion: 1,
    generatedAt,
    runId: snapshot.runId,
    configHash: snapshot.configHash,
    timezone,
    normalizedInput: {
      file: options.normalizedFile ?? `data/normalized/${snapshot.runId}.json`,
      hash: sha256Hex(JSON.stringify(snapshot))
    },
    artifacts: artifactsPayload.map((artifact) => ({
      name: artifact.name,
      hash: sha256Hex(JSON.stringify(artifact.value)),
      records: artifact.records
    })),
    rawSnapshots: snapshot.sources
      .filter((source) => source.lastFetch?.snapshotPath)
      .map((source) => ({
        sourceId: source.id,
        path: source.lastFetch?.snapshotPath ?? "",
        status: source.lastFetch?.status ?? null
      })),
    sourceFetchSummary: {
      configured: sourceHealth.summary.configured,
      ok: sourceHealth.summary.ok,
      errored: sourceHealth.summary.errored
    },
    validation
  };

  return {
    items: snapshot,
    candidates,
    digests,
    dedupGroups,
    sourceHealth,
    manifest,
    validation
  };
}
