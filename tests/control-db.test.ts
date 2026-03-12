import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

import { openControlDb } from "../src/pipeline/control-db";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("openControlDb", () => {
  test("migrates legacy sources table by adding missing control-plane columns", () => {
    const cwd = mkdtempSync(join(tmpdir(), "watchtower-db-"));
    tempDirs.push(cwd);
    const dbPath = join(cwd, "watchtower.sqlite");

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        site_url TEXT NOT NULL,
        feed_url TEXT NOT NULL,
        category TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        etag TEXT,
        last_modified TEXT,
        last_fetch_at TEXT,
        last_fetch_status INTEGER,
        last_fetch_error TEXT
      );
    `);
    legacy.close();

    const migrated = openControlDb(dbPath);
    const columns = migrated
      .prepare("PRAGMA table_info(sources)")
      .all()
      .map((row) => String((row as { name: string }).name));

    expect(columns).toContain("last_snapshot_path");
    expect(columns).toContain("fetch_policy");
  });
});
