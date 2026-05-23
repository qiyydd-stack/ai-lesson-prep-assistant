import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "./database.js";
import { createLessonStore } from "./lessonStore.js";

test("lessonStore saves lists loads and deletes lessons by user", () => {
  const db = createDatabase({ dbPath: ":memory:" });
  insertTestUser(db, "user-a");
  const store = createLessonStore(db);
  const saved = store.saveLesson("user-a", {
    title: "七年级数学 一元一次方程",
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    content: "# 教学目标\n理解方程",
    form: { subject: "数学" },
    pptOutline: { title: "方程 PPT" },
  });

  assert.ok(saved.id);
  assert.equal(store.listLessons("user-a").length, 1);
  assert.equal(store.listLessons("user-b").length, 0);
  assert.equal(store.getLesson("user-a", saved.id).content, "# 教学目标\n理解方程");
  assert.equal(store.deleteLesson("user-a", saved.id), true);
  assert.equal(store.listLessons("user-a").length, 0);
  db.close();
});

test("school resources are stored per user with indexed vector chunks", () => {
  const db = createDatabase({ dbPath: ":memory:" });
  insertTestUser(db, "user-a");
  const store = createLessonStore(db);
  const saved = store.saveSchoolResource("user-a", {
    name: "校本题库.docx",
    summary: "一元一次方程题库",
    extractedText: "一元一次方程 基础题 提升题 应用题 移项 合并同类项",
  });

  assert.ok(saved.id);
  assert.ok(saved.chunkCount > 0);
  assert.equal(store.listSchoolResources("user-a").length, 1);
  assert.equal(store.listSchoolResources("user-b").length, 0);
  assert.equal(store.listSchoolResources("user-a")[0].chunks[0].vector.length, 128);
  assert.equal(store.deleteSchoolResource("user-a", saved.id), true);
  db.close();
});

function insertTestUser(db, id) {
  db.prepare(
    "insert into users (id, name, email, password_hash, created_at) values (?, ?, ?, ?, ?)",
  ).run(id, "测试教师", `${id}@example.com`, "hash", new Date().toISOString());
}
