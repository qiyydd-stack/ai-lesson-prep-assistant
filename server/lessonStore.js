import { randomBytes } from "node:crypto";
import { createResourceChunks } from "./schoolRag.js";

export function createLessonStore(db) {
  function saveLesson(userId, input) {
    const now = new Date().toISOString();
    const id = input.id || randomBytes(12).toString("hex");
    const title = String(input.title || input.chapter || "未命名教案").trim();
    const existing = db
      .prepare("select id from lesson_plans where id = ? and user_id = ?")
      .get(id, userId);

    const record = {
      id,
      user_id: userId,
      title,
      subject: String(input.subject || input.form?.subject || "").trim(),
      grade: String(input.grade || input.form?.grade || "").trim(),
      chapter: String(input.chapter || input.form?.chapter || "").trim(),
      content: String(input.content || "").trim(),
      form_json: JSON.stringify(input.form || {}),
      ppt_outline_json: input.pptOutline ? JSON.stringify(input.pptOutline) : "",
      created_at: existing ? undefined : now,
      updated_at: now,
    };

    if (!record.content) {
      throw withStatus(new Error("教案内容不能为空。"), 400);
    }

    if (existing) {
      db.prepare(
        `update lesson_plans
         set title = ?, subject = ?, grade = ?, chapter = ?, content = ?, form_json = ?,
             ppt_outline_json = ?, updated_at = ?
         where id = ? and user_id = ?`,
      ).run(
        record.title,
        record.subject,
        record.grade,
        record.chapter,
        record.content,
        record.form_json,
        record.ppt_outline_json,
        record.updated_at,
        id,
        userId,
      );
    } else {
      db.prepare(
        `insert into lesson_plans
         (id, user_id, title, subject, grade, chapter, content, form_json, ppt_outline_json, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.id,
        record.user_id,
        record.title,
        record.subject,
        record.grade,
        record.chapter,
        record.content,
        record.form_json,
        record.ppt_outline_json,
        record.created_at,
        record.updated_at,
      );
    }

    return getLesson(userId, id);
  }

  function listLessons(userId) {
    return db
      .prepare(
        `select id, title, subject, grade, chapter, created_at as createdAt, updated_at as updatedAt
         from lesson_plans
         where user_id = ?
         order by updated_at desc`,
      )
      .all(userId);
  }

  function getLesson(userId, id) {
    const row = db
      .prepare(
        `select id, title, subject, grade, chapter, content, form_json, ppt_outline_json,
                created_at as createdAt, updated_at as updatedAt
         from lesson_plans
         where user_id = ? and id = ?`,
      )
      .get(userId, id);
    if (!row) return null;
    return {
      ...row,
      form: parseJson(row.form_json, {}),
      pptOutline: parseJson(row.ppt_outline_json, null),
      form_json: undefined,
      ppt_outline_json: undefined,
    };
  }

  function deleteLesson(userId, id) {
    const result = db
      .prepare("delete from lesson_plans where user_id = ? and id = ?")
      .run(userId, id);
    return result.changes > 0;
  }

  function saveSchoolResource(userId, input) {
    const now = new Date().toISOString();
    const id = randomBytes(12).toString("hex");
    const name = String(input.name || "未命名资源").trim();
    const summary = String(input.summary || "").trim();
    const extractedText = String(input.extractedText || "").trim();
    if (!extractedText) {
      throw withStatus(new Error("校本资源内容不能为空。"), 400);
    }

    db.prepare(
      `insert into school_resources (id, user_id, name, summary, extracted_text, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, name, summary, extractedText, now);

    const chunks = createResourceChunks({ id, name, extractedText });
    const insertChunk = db.prepare(
      `insert into school_resource_chunks
       (id, resource_id, user_id, chunk_index, text, vector_json, created_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const chunk of chunks) {
      insertChunk.run(
        `${id}-${chunk.chunkIndex}`,
        id,
        userId,
        chunk.chunkIndex,
        chunk.text,
        JSON.stringify(chunk.vector),
        now,
      );
    }

    const indexedChunks = listChunksForResources(userId, [id]).get(id) || [];
    return { id, name, summary, extractedText, chunks: indexedChunks, chunkCount: indexedChunks.length, createdAt: now };
  }

  function listSchoolResources(userId) {
    const resources = db
      .prepare(
        `select id, name, summary, extracted_text as extractedText, created_at as createdAt
         from school_resources
         where user_id = ?
         order by created_at desc`,
      )
      .all(userId);
    const chunksByResource = listChunksForResources(
      userId,
      resources.map((resource) => resource.id),
    );
    return resources.map((resource) => {
      const chunks = chunksByResource.get(resource.id) || [];
      return { ...resource, chunks, chunkCount: chunks.length };
    });
  }

  function deleteSchoolResource(userId, id) {
    const result = db
      .prepare("delete from school_resources where user_id = ? and id = ?")
      .run(userId, id);
    return result.changes > 0;
  }

  function listChunksForResources(userId, resourceIds) {
    const result = new Map();
    if (!resourceIds.length) return result;
    const placeholders = resourceIds.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `select id, resource_id as resourceId, chunk_index as chunkIndex, text, vector_json as vectorJson
         from school_resource_chunks
         where user_id = ? and resource_id in (${placeholders})
         order by resource_id, chunk_index`,
      )
      .all(userId, ...resourceIds);
    for (const row of rows) {
      const list = result.get(row.resourceId) || [];
      list.push({
        id: row.id,
        resourceId: row.resourceId,
        chunkIndex: row.chunkIndex,
        text: row.text,
        vector: parseJson(row.vectorJson, []),
      });
      result.set(row.resourceId, list);
    }
    return result;
  }

  return {
    saveLesson,
    listLessons,
    getLesson,
    deleteLesson,
    saveSchoolResource,
    listSchoolResources,
    deleteSchoolResource,
  };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function withStatus(error, statusCode) {
  error.statusCode = statusCode;
  return error;
}
