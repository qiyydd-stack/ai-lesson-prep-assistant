import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createDatabase } from "./database.js";

test("createDatabase initializes core tables", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lesson-db-"));
  try {
    const db = createDatabase({ dbPath: path.join(dir, "app.db") });
    const rows = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => row.name);

    assert.ok(rows.includes("users"));
    assert.ok(rows.includes("lesson_plans"));
    assert.ok(rows.includes("school_resources"));
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
