import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAuthService } from "./authService.js";
import { createDatabase } from "./database.js";

async function withAuthService(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lesson-auth-"));
  try {
    const db = createDatabase({ dbPath: path.join(dir, "app.db") });
    const auth = createAuthService({
      db,
      tokenSecret: "test-secret",
    });
    await fn(auth);
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("register creates a user without exposing password hash", async () => {
  await withAuthService(async (auth) => {
    const result = await auth.register({
      name: "张老师",
      email: "teacher@example.com",
      password: "password123",
    });

    assert.equal(result.user.name, "张老师");
    assert.equal(result.user.email, "teacher@example.com");
    assert.equal(result.user.passwordHash, undefined);
    assert.ok(result.token);
  });
});

test("login returns token for valid credentials", async () => {
  await withAuthService(async (auth) => {
    await auth.register({
      name: "李老师",
      email: "li@example.com",
      password: "password123",
    });

    const result = await auth.login({
      email: "li@example.com",
      password: "password123",
    });

    assert.equal(result.user.email, "li@example.com");
    assert.ok(result.token);
  });
});

test("verifyToken returns the authenticated user", async () => {
  await withAuthService(async (auth) => {
    const { token } = await auth.register({
      name: "王老师",
      email: "wang@example.com",
      password: "password123",
    });

    const user = await auth.verifyToken(token);

    assert.equal(user.email, "wang@example.com");
  });
});

test("login rejects invalid credentials", async () => {
  await withAuthService(async (auth) => {
    await auth.register({
      name: "赵老师",
      email: "zhao@example.com",
      password: "password123",
    });

    await assert.rejects(
      () => auth.login({ email: "zhao@example.com", password: "wrong-password" }),
      /邮箱或密码错误/,
    );
  });
});
