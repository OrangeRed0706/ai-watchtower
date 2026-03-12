import { join } from "node:path";

import type { ArtifactBuildResult, NormalizedSnapshot } from "../contracts/artifacts";
import { buildArtifactSet } from "./build-artifacts";
import { readJson, writeJson } from "./files";

export function runBuildArtifacts(options: {
  normalizedPath: string;
  outDir: string;
  generatedAt?: string;
  timezone?: string;
}): ArtifactBuildResult {
  const snapshot = readJson<NormalizedSnapshot>(options.normalizedPath);
  const built = buildArtifactSet(snapshot, {
    generatedAt: options.generatedAt,
    timezone: options.timezone,
    normalizedFile: options.normalizedPath
  });

  writeJson(join(options.outDir, "items.json"), built.items);
  writeJson(join(options.outDir, "candidates.json"), built.candidates);
  writeJson(join(options.outDir, "digests.json"), built.digests);
  writeJson(join(options.outDir, "dedup-groups.json"), built.dedupGroups);
  writeJson(join(options.outDir, "source-health.json"), built.sourceHealth);
  writeJson(join(options.outDir, "run-manifest.json"), built.manifest);

  return built;
}
