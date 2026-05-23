import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createAuthService } from "./authService.js";
import { createDatabase } from "./database.js";
import { createLessonStore } from "./lessonStore.js";
import { buildLessonPrompt, getSystemPrompt, validateLessonRequest } from "./lessonPrompt.js";
import { resolveModelConfig } from "./modelConfig.js";
import { pipeOpenAIStream } from "./openAIStream.js";
import { buildPptOutlinePrompt, normalizePptOutline, parseJsonObject } from "./pptOutline.js";
import { buildPptxBuffer, safeFileName } from "./pptxBuilder.js";
import { extractPlaceholders, fillPptxTemplate } from "./pptxTemplate.js";
import { parseAttachment } from "./attachmentParser.js";
import { cleanModelOutput } from "./modelOutput.js";
import {
  buildSectionRegenerationPrompt,
  validateSectionRegenerationRequest,
} from "./sectionRegeneration.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const db = createDatabase();
const authService = createAuthService({ db });
const lessonStore = createLessonStore(db);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "注册失败，请稍后重试。",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "登录失败，请稍后重试。",
    });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use("/api", requireAuth);

app.get("/api/lessons", (req, res) => {
  res.json({ lessons: lessonStore.listLessons(req.user.id) });
});

app.post("/api/lessons", (req, res) => {
  try {
    const lesson = lessonStore.saveLesson(req.user.id, req.body);
    return res.json({ lesson });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "教案保存失败，请稍后重试。",
    });
  }
});

app.get("/api/lessons/:id", (req, res) => {
  const lesson = lessonStore.getLesson(req.user.id, req.params.id);
  if (!lesson) return res.status(404).json({ error: "教案不存在。" });
  return res.json({ lesson });
});

app.delete("/api/lessons/:id", (req, res) => {
  const deleted = lessonStore.deleteLesson(req.user.id, req.params.id);
  return res.json({ deleted });
});

app.get("/api/school-resources", (req, res) => {
  res.json({ resources: lessonStore.listSchoolResources(req.user.id) });
});

app.post("/api/school-resources", (req, res) => {
  try {
    const resource = lessonStore.saveSchoolResource(req.user.id, req.body);
    return res.json({ resource });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "校本资源保存失败，请稍后重试。",
    });
  }
});

app.delete("/api/school-resources/:id", (req, res) => {
  const deleted = lessonStore.deleteSchoolResource(req.user.id, req.params.id);
  return res.json({ deleted });
});

app.post("/api/generate-lesson", async (req, res) => {
  const errors = validateLessonRequest(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const modelConfig = resolveModelConfig(req.body.apiConfig);
  if (modelConfig.error === "missing_api_key") {
    return res.status(500).json({
      error: "请先在页面右上角配置 API Key，或在服务端 .env 中设置 OPENAI_API_KEY。",
    });
  }

  try {
    const prompt = buildLessonPrompt(req.body);
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        temperature: 0.7,
        stream: true,
        messages: [
          {
            role: "system",
            content: getSystemPrompt(req.body),
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: data?.error?.message || "模型接口调用失败，请检查密钥、模型名或 base URL。",
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    return pipeOpenAIStream(response, res);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "生成失败，请稍后重试。",
    });
  }
});

async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "请先登录。" });
  }
  try {
    req.user = await authService.verifyToken(token);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: error instanceof Error ? error.message : "请先登录。",
    });
  }
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

app.post("/api/generate-ppt-outline", async (req, res) => {
  const errors = validateLessonRequest(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  if (!String(req.body.lessonContent || "").trim()) {
    return res.status(400).json({ error: "lessonContent is required" });
  }

  const modelConfig = resolveModelConfig(req.body.apiConfig);
  if (modelConfig.error === "missing_api_key") {
    return res.status(500).json({
      error: "请先在页面右上角配置 API Key，或在服务端 .env 中设置 OPENAI_API_KEY。",
    });
  }

  try {
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是中小学教学PPT设计助手。必须输出严格 JSON，不要输出 Markdown 或解释文字。",
          },
          { role: "user", content: buildPptOutlinePrompt(req.body) },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "PPT 大纲生成失败，请检查模型配置。",
      });
    }

    const content = cleanModelOutput(data?.choices?.[0]?.message?.content);
    const outline = normalizePptOutline(parseJsonObject(content));
    return res.json({ outline });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "PPT 大纲生成失败，请稍后重试。",
    });
  }
});

app.post("/api/regenerate-section", async (req, res) => {
  const errors = validateSectionRegenerationRequest(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const modelConfig = resolveModelConfig(req.body.apiConfig);
  if (modelConfig.error === "missing_api_key") {
    return res.status(500).json({
      error: "请先在页面右上角配置 API Key，或在服务端 .env 中设置 OPENAI_API_KEY。",
    });
  }

  try {
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        temperature: 0.65,
        messages: [
          {
            role: "system",
            content: "你是中小学教案局部优化助手。严格只输出用户要求重写的章节。",
          },
          { role: "user", content: buildSectionRegenerationPrompt(req.body) },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "局部重写失败，请检查模型配置。",
      });
    }

    const content = cleanModelOutput(data?.choices?.[0]?.message?.content);
    if (!content) {
      return res.status(502).json({ error: "模型返回内容为空，请重试。" });
    }

    return res.json({ sectionTitle: req.body.sectionTitle, content });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "局部重写失败，请稍后重试。",
    });
  }
});

app.post("/api/export-pptx", async (req, res) => {
  try {
    const outline = normalizePptOutline(req.body.outline);
    const templateBase64 = String(req.body.templateBase64 || "");
    const buffer = templateBase64
      ? await fillPptxTemplate(Buffer.from(templateBase64, "base64"), outline)
      : await buildPptxBuffer(outline);
    const fileName = `${safeFileName(outline.title)}.pptx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Content-Length", String(buffer.length));
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "PPTX 导出失败，请稍后重试。",
    });
  }
});

app.post("/api/inspect-pptx-template", async (req, res) => {
  try {
    const fileName = String(req.body.fileName || "");
    if (fileName.toLowerCase().endsWith(".ppt")) {
      return res.status(400).json({ error: "暂不支持 .ppt 老格式，请先另存为 .pptx 后上传。" });
    }
    if (!fileName.toLowerCase().endsWith(".pptx")) {
      return res.status(400).json({ error: "请上传 .pptx 模板文件。" });
    }

    const templateBase64 = String(req.body.templateBase64 || "");
    if (!templateBase64) {
      return res.status(400).json({ error: "templateBase64 is required" });
    }

    const placeholders = await extractPlaceholders(Buffer.from(templateBase64, "base64"));
    return res.json({ placeholders });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "模板解析失败，请检查 PPTX 文件。",
    });
  }
});

app.post("/api/parse-attachment", async (req, res) => {
  try {
    const attachment = await parseAttachment(req.body);
    return res.json({ attachment });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "资料解析失败，请检查文件后重试。",
    });
  }
});

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`AI lesson prep server running at http://localhost:${port}`);
});
