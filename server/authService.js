import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

import { createDatabase } from "./database.js";

const scrypt = promisify(scryptCallback);

export function createAuthService(options = {}) {
  const db = options.db || createDatabase({ dbPath: options.dbPath });
  const tokenSecret = options.tokenSecret || process.env.AUTH_TOKEN_SECRET || "lesson-prep-dev-secret";

  async function register(input) {
    const name = String(input?.name || "").trim();
    const email = normalizeEmail(input?.email);
    const password = String(input?.password || "");
    validateRegisterInput({ name, email, password });

    if (db.prepare("select id from users where email = ?").get(email)) {
      throw withStatus(new Error("该邮箱已注册。"), 409);
    }

    const user = {
      id: randomBytes(12).toString("hex"),
      name,
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.prepare(
      "insert into users (id, name, email, password_hash, created_at) values (?, ?, ?, ?, ?)",
    ).run(user.id, user.name, user.email, user.passwordHash, user.createdAt);

    return {
      user: publicUser(user),
      token: signToken(user.id, tokenSecret),
    };
  }

  async function login(input) {
    const email = normalizeEmail(input?.email);
    const password = String(input?.password || "");
    const user = mapUserRow(db.prepare("select * from users where email = ?").get(email));
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw withStatus(new Error("邮箱或密码错误。"), 401);
    }

    return {
      user: publicUser(user),
      token: signToken(user.id, tokenSecret),
    };
  }

  async function verifyToken(token) {
    const payload = verifySignedToken(token, tokenSecret);
    const user = mapUserRow(db.prepare("select * from users where id = ?").get(payload.userId));
    if (!user) {
      throw withStatus(new Error("登录状态已失效，请重新登录。"), 401);
    }
    return publicUser(user);
  }

  return { register, login, verifyToken };
}

function validateRegisterInput({ name, email, password }) {
  if (!name) throw withStatus(new Error("请输入姓名。"), 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw withStatus(new Error("请输入有效邮箱。"), 400);
  }
  if (password.length < 8) {
    throw withStatus(new Error("密码至少 8 位。"), 400);
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, hash] = String(passwordHash || "").split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signToken(userId, secret) {
  const payload = {
    userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifySignedToken(token, secret) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature || sign(encodedPayload, secret) !== signature) {
    throw withStatus(new Error("请先登录。"), 401);
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload.userId || Number(payload.exp) < Date.now()) {
    throw withStatus(new Error("登录已过期，请重新登录。"), 401);
  }
  return payload;
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function withStatus(error, statusCode) {
  error.statusCode = statusCode;
  return error;
}
