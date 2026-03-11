#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

const { buildCandidates, buildDigests, buildDedupGroups } = require("./lib/publish");

const DEFAULT_OUT_DIR = path.join(process.cwd(), "artifacts");
const DEFAULT_INGESTED_PATH = path.join(DEFAULT_OUT_DIR, "ingested.json");
const LEGACY_INGESTED_PATH = path.join(process.cwd(), "src", "_data", "ingested.json");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function resolveIngestedPath(cliPath) {
  const p = cliPath ? path.resolve(cliPath) : path.resolve(DEFAULT_INGESTED_PATH);
  if (fs.existsSync(p)) return p;
  if (!cliPath && fs.existsSync(LEGACY_INGESTED_PATH)) return path.resolve(LEGACY_INGESTED_PATH);
  return p;
}

async function main() {
  const { values } = parseArgs({
    options: {
      ingested: { type: "string" },
      outDir: { type: "string", default: DEFAULT_OUT_DIR }
    }
  });

  const outDir = path.resolve(values.outDir);
  const ingestedPath = resolveIngestedPath(values.ingested);

  if (!fs.existsSync(ingestedPath)) {
    console.error(`Missing ingested snapshot: ${path.relative(process.cwd(), ingestedPath)}`);
    console.error("Run: npm run ingest");
    process.exit(2);
  }

  const ingested = readJson(ingestedPath);

  ensureDir(outDir);
  writeJson(path.join(outDir, "candidates.json"), buildCandidates(ingested));
  writeJson(path.join(outDir, "digests.json"), buildDigests(ingested));
  writeJson(path.join(outDir, "dedupGroups.json"), buildDedupGroups(ingested));

  console.log(
    JSON.stringify(
      {
        ingested: path.relative(process.cwd(), ingestedPath),
        outDir: path.relative(process.cwd(), outDir),
        wrote: ["candidates.json", "digests.json", "dedupGroups.json"]
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

