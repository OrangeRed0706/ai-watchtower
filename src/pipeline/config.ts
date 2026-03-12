import { readFileSync } from "node:fs";

import { z } from "zod";

const sourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  siteUrl: z.string().min(1),
  feedUrl: z.string().default(""),
  category: z.string().default(""),
  tier: z.enum(["official", "primary", "reference", "secondary"]).nullable().optional(),
  priority: z.number().int().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  fetchPolicy: z.enum(["feed", "manual"]).nullable().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().default(true)
});

const sourceRegistrySchema = z.object({
  version: z.number().int().positive(),
  sources: z.array(sourceConfigSchema)
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;

export function loadSourceRegistry(configPath: string): SourceRegistry {
  const raw = readFileSync(configPath, "utf8");
  return sourceRegistrySchema.parse(JSON.parse(raw));
}
