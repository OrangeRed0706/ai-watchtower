#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { runIngest } from "../pipeline/ingest";
import { runNormalize } from "../pipeline/run-normalize";
import { runBuildArtifacts } from "../pipeline/write-artifacts";
import { getLatestRunId, openControlDb } from "../pipeline/control-db";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [command = "pipeline", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

function resolveFlag(flags: Record<string, string>, key: string, fallback: string): string {
  return resolve(flags[key] ?? fallback);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const configPath = resolveFlag(flags, "config", "config/sources.json");
  const dbPath = resolveFlag(flags, "db", ".data/watchtower.sqlite");
  const rawDir = resolveFlag(flags, "raw-dir", "data/raw");
  const normalizedDir = resolveFlag(flags, "normalized-dir", "data/normalized");
  const outDir = resolveFlag(flags, "out-dir", "artifacts");
  const nowIso = flags["now"] ?? new Date().toISOString();
  const timezone = flags["timezone"] ?? "Asia/Taipei";

  if (command === "ingest") {
    const result = await runIngest({ configPath, dbPath, rawDir, nowIso });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "normalize") {
    const runId = flags["run-id"] ?? getLatestRunId(openControlDb(dbPath));
    if (!runId) {
      throw new Error("No run available for normalize. Run ingest first or pass --run-id.");
    }
    const result = await runNormalize({
      configPath,
      dbPath,
      rawDir,
      normalizedDir,
      runId,
      nowIso,
      timezone
    });
    process.stdout.write(`${JSON.stringify({ runId: result.runId, items: result.items.length }, null, 2)}\n`);
    return;
  }

  if (command === "build-artifacts") {
    const normalizedPath = resolve(flags["normalized"] ?? joinLatest(normalizedDir));
    const built = runBuildArtifacts({
      normalizedPath,
      outDir,
      generatedAt: nowIso,
      timezone
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: built.manifest.runId,
          artifacts: built.manifest.artifacts,
          validation: built.validation
        },
        null,
        2
      )}\n`
    );
    return;
  }

  if (command === "build") {
    const normalizedPath = flags["normalized"] ? resolve(flags["normalized"]) : maybeJoinLatest(normalizedDir);
    if (normalizedPath) {
      runBuildArtifacts({
        normalizedPath,
        outDir,
        generatedAt: nowIso,
        timezone
      });
    }
    execFileSync("npx", ["eleventy"], {
      stdio: "inherit",
      env: process.env
    });
    return;
  }

  if (command === "pipeline") {
    const ingest = await runIngest({ configPath, dbPath, rawDir, nowIso });
    const normalized = await runNormalize({
      configPath,
      dbPath,
      rawDir,
      normalizedDir,
      runId: ingest.runId,
      nowIso,
      timezone
    });
    const built = runBuildArtifacts({
      normalizedPath: resolve(normalizedDir, `${normalized.runId}.json`),
      outDir,
      generatedAt: nowIso,
      timezone
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: ingest.runId,
          rawSnapshots: ingest.rawSnapshots.length,
          normalizedItems: normalized.items.length,
          artifacts: built.manifest.artifacts
        },
        null,
        2
      )}\n`
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function joinLatest(normalizedDir: string): string {
  const filePath = resolve(normalizedDir, "latest.json");
  if (!existsSync(filePath)) {
    throw new Error(`Missing normalized snapshot: ${filePath}`);
  }
  return filePath;
}

function maybeJoinLatest(normalizedDir: string): string | null {
  const filePath = resolve(normalizedDir, "latest.json");
  return existsSync(filePath) ? filePath : null;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
