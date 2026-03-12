import type { JSONSchemaType } from "ajv";
import { z } from "zod";

export type SourceTier = "official" | "primary" | "reference" | "secondary";
export type FetchPolicy = "feed" | "manual";
export type ImpactArea = "model" | "product" | "tooling" | "policy" | "security";
export type ImpactLevel = "low" | "medium" | "high";

export interface SourceFetchState {
  ok: boolean;
  status: number | null;
  at: string;
  error?: string;
  snapshotPath?: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  siteUrl: string;
  feedUrl: string;
  category: string;
  tier: SourceTier | null;
  priority: number | null;
  sourceType: string | null;
  fetchPolicy: FetchPolicy | null;
  enabled: boolean;
  lastFetch?: SourceFetchState;
}

export interface NormalizedItem {
  runId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
  sourcePriority: number | null;
  sourceTier: SourceTier | null;
  sourceType: string | null;
  category: string | null;
  entryUid: string;
  guid: string | null;
  url: string | null;
  title: string;
  snippet: string;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string | null;
  fingerprint: string;
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface NormalizedSnapshot {
  schemaVersion: number;
  runId: string;
  generatedAt: string;
  configHash: string;
  window: {
    start: string;
    end: string;
    timezone: string;
  };
  sources: SourceRecord[];
  items: NormalizedItem[];
}

export interface ScoreReason {
  key: string;
  delta: number;
  note?: string;
}

export interface ClassificationReason {
  key: string;
  note?: string;
}

export interface Classification {
  version: number;
  impactArea: ImpactArea;
  impactLevel: ImpactLevel;
  tags: string[];
  reasons: ClassificationReason[];
}

export interface ScoredItem extends NormalizedItem {
  score: number;
  scoreVersion: number;
  scoreAgeHours: number | null;
  scoreReasons: ScoreReason[];
  classification: Classification;
  dedup: {
    version: number;
    key: string;
    basis: "url" | "contentHash" | "titleDay";
    groupSize: number;
    isCanonical: boolean;
  };
}

export interface CandidateArtifact {
  schemaVersion: number;
  generatedAt: string;
  runId: string;
  configHash: string;
  totalItems: number;
  uniqueItems: number;
  topCount: number;
  items: ScoredItem[];
}

export interface DedupGroupArtifact {
  key: string;
  basis: "url" | "contentHash" | "titleDay";
  value: string | null;
  memberCount: number;
  sources: Array<{ id: string; name: string; url: string | null }>;
  canonical: {
    fingerprint: string;
    title: string;
    url: string | null;
    publishedAt: string | null;
    score: number;
  };
  members: Array<{
    fingerprint: string;
    title: string;
    url: string | null;
    sourceId: string;
    sourceName: string;
    score: number;
    isCanonical: boolean;
  }>;
}

export interface DedupGroupsArtifact {
  schemaVersion: number;
  generatedAt: string;
  runId: string;
  configHash: string;
  stats: {
    groups: number;
    itemsIn: number;
    itemsOut: number;
    duplicateItems: number;
  };
  groups: DedupGroupArtifact[];
}

export interface DigestArtifact {
  date: string;
  title: string;
  summary: string;
  items: Array<{
    title: string;
    url: string | null;
    snippet: string;
    impactArea: ImpactArea;
    impactLevel: ImpactLevel;
    tags: string[];
    score: number;
    sources: Array<{ name: string; url: string | null }>;
    dedup: ScoredItem["dedup"];
  }>;
}

export interface SourceHealthArtifact {
  schemaVersion: number;
  generatedAt: string;
  runId: string;
  configHash: string;
  sources: SourceRecord[];
  summary: {
    configured: number;
    ok: number;
    errored: number;
    hasRuntimeData: boolean;
  };
}

export interface RunManifestArtifact {
  schemaVersion: number;
  generatedAt: string;
  runId: string;
  configHash: string;
  timezone: string;
  normalizedInput: {
    file: string;
    hash: string;
  };
  artifacts: Array<{
    name: string;
    hash: string;
    records: number;
  }>;
  rawSnapshots: Array<{
    sourceId: string;
    path: string;
    status: number | null;
  }>;
  sourceFetchSummary: {
    configured: number;
    ok: number;
    errored: number;
  };
  validation: {
    valid: boolean;
    errors: string[];
  };
}

export interface ArtifactValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ArtifactBuildResult {
  items: NormalizedSnapshot;
  candidates: CandidateArtifact;
  digests: DigestArtifact[];
  dedupGroups: DedupGroupsArtifact;
  sourceHealth: SourceHealthArtifact;
  manifest: RunManifestArtifact;
  validation: ArtifactValidationResult;
}

export const normalizedSnapshotSchema = z.object({
  schemaVersion: z.number().int().positive(),
  runId: z.string().min(1),
  generatedAt: z.string().datetime(),
  configHash: z.string().min(1),
  window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    timezone: z.string().min(1)
  }),
  sources: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      siteUrl: z.string().min(1),
      feedUrl: z.string().min(0),
      category: z.string().min(0),
      tier: z.enum(["official", "primary", "reference", "secondary"]).nullable(),
      priority: z.number().int().nullable(),
      sourceType: z.string().nullable(),
      fetchPolicy: z.enum(["feed", "manual"]).nullable(),
      enabled: z.boolean(),
      lastFetch: z
        .object({
          ok: z.boolean(),
          status: z.number().int().nullable(),
          at: z.string().datetime(),
          error: z.string().optional(),
          snapshotPath: z.string().optional()
        })
        .optional()
    })
  ),
  items: z.array(
    z.object({
      runId: z.string().min(1),
      sourceId: z.string().min(1),
      sourceName: z.string().min(1),
      sourceUrl: z.string().nullable(),
      sourcePriority: z.number().int().nullable(),
      sourceTier: z.enum(["official", "primary", "reference", "secondary"]).nullable(),
      sourceType: z.string().nullable(),
      category: z.string().nullable(),
      entryUid: z.string().min(1),
      guid: z.string().nullable(),
      url: z.string().nullable(),
      title: z.string().min(1),
      snippet: z.string(),
      publishedAt: z.string().datetime().nullable(),
      updatedAt: z.string().datetime().nullable(),
      author: z.string().nullable(),
      fingerprint: z.string().min(1),
      contentHash: z.string().min(1),
      firstSeenAt: z.string().datetime(),
      lastSeenAt: z.string().datetime()
    })
  )
});

export const candidateArtifactSchema: JSONSchemaType<CandidateArtifact> = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "generatedAt", "runId", "configHash", "totalItems", "uniqueItems", "topCount", "items"],
  properties: {
    schemaVersion: { type: "integer" },
    generatedAt: { type: "string" },
    runId: { type: "string" },
    configHash: { type: "string" },
    totalItems: { type: "integer" },
    uniqueItems: { type: "integer" },
    topCount: { type: "integer" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: [
          "runId",
          "sourceId",
          "sourceName",
          "sourceUrl",
          "sourcePriority",
          "sourceTier",
          "sourceType",
          "category",
          "entryUid",
          "guid",
          "url",
          "title",
          "snippet",
          "publishedAt",
          "updatedAt",
          "author",
          "fingerprint",
          "contentHash",
          "firstSeenAt",
          "lastSeenAt",
          "score",
          "scoreVersion",
          "scoreAgeHours",
          "scoreReasons",
          "classification",
          "dedup"
        ],
        properties: {
          runId: { type: "string" },
          sourceId: { type: "string" },
          sourceName: { type: "string" },
          sourceUrl: { type: "string", nullable: true },
          sourcePriority: { type: "integer", nullable: true },
          sourceTier: { type: "string", nullable: true },
          sourceType: { type: "string", nullable: true },
          category: { type: "string", nullable: true },
          entryUid: { type: "string" },
          guid: { type: "string", nullable: true },
          url: { type: "string", nullable: true },
          title: { type: "string" },
          snippet: { type: "string" },
          publishedAt: { type: "string", nullable: true },
          updatedAt: { type: "string", nullable: true },
          author: { type: "string", nullable: true },
          fingerprint: { type: "string" },
          contentHash: { type: "string" },
          firstSeenAt: { type: "string" },
          lastSeenAt: { type: "string" },
          score: { type: "integer" },
          scoreVersion: { type: "integer" },
          scoreAgeHours: { type: "number", nullable: true },
          scoreReasons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "delta"],
              properties: {
                key: { type: "string" },
                delta: { type: "integer" },
                note: { type: "string", nullable: true }
              }
            }
          },
          classification: {
            type: "object",
            additionalProperties: false,
            required: ["version", "impactArea", "impactLevel", "tags", "reasons"],
            properties: {
              version: { type: "integer" },
              impactArea: { type: "string" },
              impactLevel: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              reasons: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key"],
                  properties: {
                    key: { type: "string" },
                    note: { type: "string", nullable: true }
                  }
                }
              }
            }
          },
          dedup: {
            type: "object",
            additionalProperties: false,
            required: ["version", "key", "basis", "groupSize", "isCanonical"],
            properties: {
              version: { type: "integer" },
              key: { type: "string" },
              basis: { type: "string" },
              groupSize: { type: "integer" },
              isCanonical: { type: "boolean" }
            }
          }
        }
      }
    }
  }
};
