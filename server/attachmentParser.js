import mammoth from "mammoth";
import * as XLSX from "xlsx";

import { resolveModelConfig } from "./modelConfig.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
const WORD_EXTENSIONS = new Set([".docx"]);
const WORKBOOK_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const UNSUPPORTED_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".msi", ".dll", ".ps1"]);

export function validateAttachmentInput(input) {
  const errors = [];
  const fileName = String(input?.fileName || "");
  const fileBase64 = String(input?.fileBase64 || "");
  if (!fileName.trim()) errors.push("fileName is required");
  if (!fileBase64.trim()) errors.push("fileBase64 is required");

  const extension = getExtension(fileName);
  if (UNSUPPORTED_EXTENSIONS.has(extension)) {
    errors.push("不支持上传可执行文件，请上传 Word、Excel、文本、Markdown 或图片资料。");
  } else if (![...TEXT_EXTENSIONS, ...WORD_EXTENSIONS, ...WORKBOOK_EXTENSIONS, ...IMAGE_EXTENSIONS].includes(extension)) {
    errors.push("暂只支持 .txt、.md、.docx、.xlsx、.xls、.csv、.png、.jpg、.jpeg、.webp 文件。");
  }
  return errors;
}

export async function parseAttachment(input) {
  const errors = validateAttachmentInput(input);
  if (errors.length) {
    const error = new Error(errors.join("; "));
    error.statusCode = 400;
    throw error;
  }

  const fileName = String(input.fileName).trim();
  const sourceArea = String(input.sourceArea || "通用资料").trim();
  const buffer = Buffer.from(String(input.fileBase64), "base64");
  const extension = getExtension(fileName);

  if (TEXT_EXTENSIONS.has(extension)) {
    return parseTextLikeAttachment({ fileName, sourceArea, buffer });
  }

  if (WORD_EXTENSIONS.has(extension)) {
    return parseWordAttachment({ fileName, sourceArea, buffer });
  }

  if (WORKBOOK_EXTENSIONS.has(extension)) {
    return parseWorkbookAttachment({ fileName, sourceArea, buffer });
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return parseImageAttachment({ fileName, sourceArea, buffer, extension, apiConfig: input.apiConfig });
  }

  throw new Error("Unsupported attachment type.");
}

export function parseTextLikeAttachment({ fileName, sourceArea, buffer }) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
  return buildParsedAttachment({
    fileName,
    sourceArea,
    extractedText: text,
    summary: summarizeText(text),
  });
}

export async function parseWordAttachment({ fileName, sourceArea, buffer }) {
  const result = await mammoth.extractRawText({ buffer });
  const text = String(result.value || "").trim();
  return buildParsedAttachment({
    fileName,
    sourceArea,
    extractedText: text,
    summary: summarizeText(text),
  });
}

export function parseWorkbookAttachment({ fileName, sourceArea, buffer }) {
  const extension = getExtension(fileName);
  if (extension === ".csv") {
    return parseTextLikeAttachment({ fileName, sourceArea, buffer });
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const text = workbook.SheetNames.slice(0, 6)
    .map((sheetName) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]).trim();
      return csv ? `【${sheetName}】\n${csv}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return buildParsedAttachment({
    fileName,
    sourceArea,
    extractedText: text,
    summary: summarizeText(text),
  });
}

export async function parseImageAttachment({ fileName, sourceArea, buffer, extension, apiConfig }) {
  const modelConfig = resolveModelConfig(apiConfig);
  if (modelConfig.error === "missing_api_key") {
    const error = new Error("识别图片需要先在页面右上角配置支持视觉能力的模型 API Key。");
    error.statusCode = 400;
    throw error;
  }

  const mimeType = extension === ".jpg" ? "image/jpeg" : `image/${extension.slice(1)}`;
  const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${modelConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "你是教学资料图片识别助手。请准确识别图片中的题目、选项、表格、图形文字和关键条件；如果看不清，明确说明不确定处。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "请提取这张教学资料图片中的可用内容。若是练习册或试卷，请按题号整理题干、选项、条件和图表文字，不要解题。",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "图片识别失败，请检查模型是否支持视觉输入。");
    error.statusCode = response.status;
    throw error;
  }

  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    const error = new Error("图片识别结果为空，请换一张更清晰的图片。");
    error.statusCode = 502;
    throw error;
  }

  return buildParsedAttachment({
    fileName,
    sourceArea,
    extractedText: text,
    summary: summarizeText(text),
  });
}

function buildParsedAttachment({ fileName, sourceArea, extractedText, summary }) {
  return {
    name: fileName,
    sourceArea,
    type: getExtension(fileName).slice(1),
    extractedText: String(extractedText || "").slice(0, 12000),
    summary: String(summary || "").slice(0, 500),
  };
}

function summarizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function getExtension(fileName) {
  const match = String(fileName || "").toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}
