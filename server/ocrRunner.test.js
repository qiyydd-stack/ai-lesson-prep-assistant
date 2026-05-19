import test from "node:test";
import assert from "node:assert/strict";

import { parseOcrStdout, shouldPreferLocalOcr } from "./ocrRunner.js";

test("parseOcrStdout reads text from python json output", () => {
  const parsed = parseOcrStdout(JSON.stringify({ text: "1. 解方程 2x+3=7", engine: "rapidocr" }));

  assert.equal(parsed.text, "1. 解方程 2x+3=7");
  assert.equal(parsed.engine, "rapidocr");
});

test("parseOcrStdout rejects empty OCR text", () => {
  assert.throws(() => parseOcrStdout(JSON.stringify({ text: "" })), /未识别到文字/);
});

test("shouldPreferLocalOcr prefers OCR for MiniMax text models", () => {
  assert.equal(
    shouldPreferLocalOcr({
      baseUrl: "https://api.minimaxi.com/v1",
      model: "MiniMax-M2.7",
    }),
    true,
  );
});
