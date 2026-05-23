import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createDatabase(options = {}) {
  const dbPath = options.dbPath || process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), "data", "app.db");
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(db);
  return db;
}

function initializeSchema(db) {
  db.exec(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      created_at text not null
    );

    create table if not exists lesson_plans (
      id text primary key,
      user_id text not null,
      title text not null,
      subject text,
      grade text,
      chapter text,
      content text not null,
      form_json text not null,
      ppt_outline_json text,
      created_at text not null,
      updated_at text not null,
      foreign key (user_id) references users(id) on delete cascade
    );

    create table if not exists school_resources (
      id text primary key,
      user_id text not null,
      name text not null,
      summary text,
      extracted_text text not null,
      created_at text not null,
      foreign key (user_id) references users(id) on delete cascade
    );

    create table if not exists school_resource_chunks (
      id text primary key,
      resource_id text not null,
      user_id text not null,
      chunk_index integer not null,
      text text not null,
      vector_json text not null,
      created_at text not null,
      foreign key (resource_id) references school_resources(id) on delete cascade,
      foreign key (user_id) references users(id) on delete cascade
    );

    create index if not exists idx_school_resource_chunks_user on school_resource_chunks(user_id);
    create index if not exists idx_school_resource_chunks_resource on school_resource_chunks(resource_id);
  `);
}
