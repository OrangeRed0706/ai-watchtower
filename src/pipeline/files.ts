import { gunzipSync, gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function ensureDirForFile(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDirForFile(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function writeJsonlGz(filePath: string, rows: unknown[]): void {
  ensureDirForFile(filePath);
  const payload = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(filePath, gzipSync(payload), "binary");
}

export function readJsonlGz<T>(filePath: string): T[] {
  const buffer = readFileSync(filePath);
  const text = gunzipSync(buffer).toString("utf8").trim();
  if (!text) return [];
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function listFilesRecursive(rootDir: string): string[] {
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...listFilesRecursive(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files.sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
