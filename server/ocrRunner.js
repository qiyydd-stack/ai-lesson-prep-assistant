import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runLocalOcr({ buffer, extension }) {
  const safeExtension = normalizeImageExtension(extension);
  const tempPath = path.join(os.tmpdir(), `lesson-prep-ocr-${randomUUID()}${safeExtension}`);

  try {
    await fs.writeFile(tempPath, buffer);
    const scriptPath = path.resolve(process.cwd(), "server", "ocr", "recognize.py");
    const { stdout } = await execFileAsync("python", [scriptPath, tempPath], {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    return parseOcrStdout(stdout);
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

export function parseOcrStdout(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout || "").trim());
  } catch {
    throw new Error("OCR 输出格式异常，请检查 RapidOCR 是否正常运行。");
  }

  const text = String(parsed?.text || "").trim();
  if (!text) {
    throw new Error("OCR 未识别到文字，请换一张更清晰的图片。");
  }

  return {
    text,
    engine: String(parsed?.engine || "rapidocr"),
  };
}

export function shouldPreferLocalOcr(modelConfig = {}) {
  const baseUrl = String(modelConfig.baseUrl || "").toLowerCase();
  const model = String(modelConfig.model || "").toLowerCase();
  return baseUrl.includes("api.minimaxi.com") || model.includes("minimax-m2");
}

function normalizeImageExtension(extension) {
  const value = String(extension || ".png").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp"].includes(value) ? value : ".png";
}
